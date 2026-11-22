"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  PlusIcon,
  TrashIcon,
  FolderIcon,
  LoaderIcon,
  ImageIcon,
  SparklesIcon,
  ArrowLeftIcon,
  SendIcon,
  CalendarIcon,
  CheckIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeOffIcon,
  ShareIcon,
  CloseIcon,
  SearchIcon,
  ArrowUpRightIcon,
  SettingsIcon,
} from "@/components/icons/wallora-icons";
import { useVerificationGate } from "@/components/verification/verification-gate";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types — mirror the API contract.
// ---------------------------------------------------------------------------

type ProjectStatus = "planning" | "in_progress" | "completed" | "archived";

type ProjectMeta = {
  status: ProjectStatus;
  progress: number;
  targetDate: string | null;
  milestones: { id: string; title: string; done: boolean; completedAt: string | null }[];
};

type ProjectListItem = {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  assetCount: number;
  noteCount: number;
  shoutoutCount: number;
  meta: ProjectMeta;
};

type ProjectAsset = {
  id: string;
  assetType: "wallpaper" | "generation";
  wallpaperId: string | null;
  generationId: string | null;
  note: string | null;
  createdAt: string;
  wallpaper: {
    id: string;
    slug: string;
    title: string;
    orientation: string;
    dominantColor: string | null;
    gridAsset: { objectKey: string; width: number; height: number } | null;
  } | null;
  generation: {
    id: string;
    prompt: string;
    publicUrl: string | null;
    width: number;
    height: number;
    aspectRatio: string;
  } | null;
};

type ProjectNote = { id: string; content: string; createdAt: string };

type ProjectDetail = {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  assets: ProjectAsset[];
  notes: ProjectNote[];
  meta: ProjectMeta;
};

type CatalogWallpaper = {
  id: string;
  title: string;
  orientation: string;
  gridAsset: { objectKey: string; width: number; height: number } | null;
};

type CatalogGeneration = {
  id: string;
  prompt: string;
  status: string;
  publicUrl: string | null;
  aspectRatio: string;
};

const STATUS_META: Record<ProjectStatus, { label: string; className: string }> = {
  planning: { label: "Planning", className: "border-border bg-raised text-secondary-text" },
  in_progress: { label: "In progress", className: "border-primary/30 bg-primary/10 text-primary" },
  completed: { label: "Completed", className: "border-success/30 bg-success/10 text-success" },
  archived: { label: "Archived", className: "border-border bg-surface text-secondary-text" },
};

const DEFAULT_META: ProjectMeta = {
  status: "planning",
  progress: 0,
  targetDate: null,
  milestones: [],
};

function assetImage(asset: ProjectAsset): string | null {
  return asset.assetType === "generation"
    ? asset.generation?.publicUrl ?? null
    : asset.wallpaper?.gridAsset?.objectKey ?? null;
}

function coverFrom(project: { coverUrl: string | null; assets: ProjectAsset[] }): string | null {
  if (project.coverUrl) return project.coverUrl;
  for (const asset of project.assets) {
    const img = assetImage(asset);
    if (img) return img;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProjectsPage() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-background">
        <LoaderIcon size={24} className="animate-spin text-primary" />
        <span className="sr-only">Loading projects…</span>
      </div>
    );
  }

  if (status !== "authenticated") return <SignedOutState />;
  return <ProjectsWorkspace />;
}

function SignedOutState() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface text-primary">
          <FolderIcon size={32} />
        </span>
        <div className="space-y-1.5">
          <h1 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
            Sign in to view your projects
          </h1>
          <p className="mx-auto max-w-md text-sm text-secondary-text">
            Projects turn your wallpapers, AI generations and notes into real showcases you can be
            proud of — and share with the community.
          </p>
        </div>
        <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/login?callbackUrl=/projects">Sign in to continue</Link>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

function ProjectsWorkspace() {
  const queryClient = useQueryClient();
  const { guard } = useVerificationGate();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showNewForm, setShowNewForm] = React.useState(false);
  const [showCatalog, setShowCatalog] = React.useState(false);

  React.useEffect(() => {
    if (selectedId) setShowNewForm(false);
  }, [selectedId]);

  const { data: projectsData, isLoading: loadingList } = useQuery<{ data: ProjectListItem[] }>({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/v1/projects", { cache: "no-store" });
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });
  const projects = projectsData?.data ?? [];

  const { data: detailData, isLoading: loadingDetail } = useQuery<{ data: ProjectDetail }>({
    queryKey: ["project", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/projects/${selectedId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load project");
      return res.json();
    },
    enabled: !!selectedId,
  });
  const project = detailData?.data;

  // Catalogs for the add-asset picker, loaded lazily when opened.
  const { data: wallpaperCatalog } = useQuery<{ data: { items: CatalogWallpaper[] } }>({
    queryKey: ["my-wallpapers-catalog"],
    queryFn: () => fetch("/api/v1/users/me/wallpapers?limit=24").then((r) => r.json()),
    enabled: showCatalog,
  });
  const { data: generationCatalog } = useQuery<{ data: { items: CatalogGeneration[] } }>({
    queryKey: ["my-generations-catalog"],
    queryFn: () => fetch("/api/v1/ai/generations?limit=24").then((r) => r.json()),
    enabled: showCatalog,
  });

  const refresh = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    if (selectedId) queryClient.invalidateQueries({ queryKey: ["project", selectedId] });
  }, [queryClient, selectedId]);

  const createMutation = useMutation({
    mutationFn: async (input: { name: string; description?: string; coverUrl?: string; isPublic?: boolean }) => {
      const res = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to create project");
      return json as { data: ProjectListItem; message: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setShowNewForm(false);
      setSelectedId(data.data.id);
      toast.success("Project created", { description: "Now add assets and milestones to make it yours." });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const res = await fetch(`/api/v1/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to update project");
      return json;
    },
    onSuccess: () => {
      refresh();
      toast.success("Project updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const metaMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ProjectMeta> }) => {
      const res = await fetch(`/api/v1/projects/${id}/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to update progress");
      return json;
    },
    onSuccess: () => refresh(),
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/projects/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to delete project");
      return json;
    },
    onSuccess: (_d, deletedId) => {
      if (selectedId === deletedId) setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.removeQueries({ queryKey: ["project", deletedId] });
      toast.success("Project deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ projectId, content }: { projectId: string; content: string }) => {
      const res = await fetch(`/api/v1/projects/${projectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to add note");
      return json;
    },
    onSuccess: () => {
      refresh();
      toast.success("Note added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeNoteMutation = useMutation({
    mutationFn: async ({ projectId, noteId }: { projectId: string; noteId: string }) => {
      const res = await fetch(`/api/v1/projects/${projectId}/notes?noteId=${noteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to remove note");
      return json;
    },
    onSuccess: () => refresh(),
    onError: (err: Error) => toast.error(err.message),
  });

  const addAssetMutation = useMutation({
    mutationFn: async ({
      projectId,
      payload,
    }: {
      projectId: string;
      payload: { assetType: "wallpaper" | "generation"; wallpaperId?: string; generationId?: string; note?: string };
    }) => {
      const res = await fetch(`/api/v1/projects/${projectId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to add asset");
      return json;
    },
    onSuccess: () => {
      refresh();
      toast.success("Asset added to project");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeAssetMutation = useMutation({
    mutationFn: async ({ projectId, assetId }: { projectId: string; assetId: string }) => {
      const res = await fetch(`/api/v1/projects/${projectId}/assets?assetId=${assetId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to remove asset");
      return json;
    },
    onSuccess: () => refresh(),
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCreate = (input: { name: string; description?: string; coverUrl?: string; isPublic?: boolean }) => {
    guard(() => createMutation.mutate(input), { action: "start a project" });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-surface/40 md:flex">
        <SidebarHeader />
        <div className="border-b border-border p-3">
          <Button
            className="w-full justify-start bg-primary/15 text-primary hover:bg-primary/25"
            variant="ghost"
            onClick={() => {
              setSelectedId(null);
              setShowNewForm(true);
            }}
          >
            <PlusIcon size={16} />
            New project
          </Button>
          <Button
            variant="ghost"
            className="mt-1 w-full justify-start text-secondary-text hover:text-foreground"
            asChild
          >
            <Link href="/projects/showcase">
              <ArrowUpRightIcon size={16} />
              Explore showcases
            </Link>
          </Button>
        </div>
        <ProjectList
          projects={projects}
          loading={loadingList}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setShowNewForm(false);
            setShowCatalog(false);
          }}
          onDelete={(id) => deleteMutation.mutate(id)}
          deletingId={deleteMutation.isPending ? selectedId ?? "" : ""}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            {selectedId && !showNewForm ? (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedId(null)} aria-label="Back to projects">
                <ArrowLeftIcon size={16} />
              </Button>
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface text-primary">
                <FolderIcon size={16} />
              </span>
            )}
            <span className="font-display text-sm font-semibold text-foreground">
              {selectedId && project ? project.name : showNewForm ? "New project" : "Projects"}
            </span>
          </div>
          {!selectedId && (
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => { setSelectedId(null); setShowNewForm(true); }}>
              <PlusIcon size={14} />
              New
            </Button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
            {showNewForm ? (
              <NewProjectForm
                onCancel={() => setShowNewForm(false)}
                onSubmit={handleCreate}
                isSubmitting={createMutation.isPending}
              />
            ) : selectedId ? (
              loadingDetail || !project ? (
                <div className="flex h-64 items-center justify-center">
                  <LoaderIcon size={24} className="animate-spin text-primary" />
                  <span className="sr-only">Loading project…</span>
                </div>
              ) : (
                <ProjectDetailView
                  project={project}
                  onDelete={() => deleteMutation.mutate(project.id)}
                  isDeleting={deleteMutation.isPending}
                  onPatch={(patch) => patchMutation.mutate({ id: project.id, patch })}
                  isPatching={patchMutation.isPending}
                  onPatchMeta={(patch) => metaMutation.mutate({ id: project.id, patch })}
                  isPatchingMeta={metaMutation.isPending}
                  onAddNote={(content) => addNoteMutation.mutate({ projectId: project.id, content })}
                  onRemoveNote={(noteId) => removeNoteMutation.mutate({ projectId: project.id, noteId })}
                  isAddingNote={addNoteMutation.isPending}
                  onAddAsset={(payload) => addAssetMutation.mutate({ projectId: project.id, payload })}
                  isAddingAsset={addAssetMutation.isPending}
                  onRemoveAsset={(assetId) => removeAssetMutation.mutate({ projectId: project.id, assetId })}
                  catalogWallpapers={wallpaperCatalog?.data.items ?? []}
                  catalogGenerations={generationCatalog?.data.items ?? []}
                  catalogOpen={showCatalog}
                  onCatalogOpen={() => setShowCatalog(true)}
                  onCatalogClose={() => setShowCatalog(false)}
                />
              )
            ) : (
              <EmptyState
                projects={projects}
                loading={loadingList}
                onNewProject={() => { setSelectedId(null); setShowNewForm(true); }}
                onSelect={(id) => { setSelectedId(id); setShowCatalog(false); }}
                onDelete={(id) => deleteMutation.mutate(id)}
                deletingId={deleteMutation.isPending ? selectedId ?? "" : ""}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar + list
// ---------------------------------------------------------------------------

function SidebarHeader() {
  return (
    <div className="flex items-center justify-between border-b border-border p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface text-primary">
          <FolderIcon size={16} />
        </span>
        <div className="flex flex-col leading-tight">
          <span className="font-display text-sm font-semibold text-foreground">Projects</span>
          <span className="text-[10px] text-secondary-text">Your creative showcases</span>
        </div>
      </div>
    </div>
  );
}

function ProjectList({
  projects,
  loading,
  selectedId,
  onSelect,
  onDelete,
  deletingId,
}: {
  projects: ProjectListItem[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  deletingId: string;
}) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <LoaderIcon size={20} className="animate-spin text-secondary-text" />
      </div>
    );
  }
  if (projects.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center gap-2 p-6 text-center">
        <FolderIcon size={28} className="text-secondary-text" />
        <p className="text-xs text-secondary-text">No projects yet. Create your first to get started.</p>
      </div>
    );
  }
  return (
    <nav className="flex-1 overflow-y-auto p-2" aria-label="Project list">
      {projects.map((p) => (
        <div
          key={p.id}
          role="button"
          tabIndex={0}
          className={cn(
            "group mb-1 flex cursor-pointer items-center gap-2.5 rounded-lg p-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            selectedId === p.id ? "bg-raised text-foreground" : "text-secondary-text hover:bg-surface hover:text-foreground",
          )}
          onClick={() => onSelect(p.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(p.id);
            }
          }}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-raised">
            {p.coverUrl ? (
              <img src={p.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <FolderIcon size={16} className="text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-medium">{p.name}</span>
              {p.isPublic && <EyeIcon size={11} className="shrink-0 text-primary" />}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary" style={{ width: `${p.meta.progress ?? 0}%` }} />
              </div>
              <span className="text-[9px] text-secondary-text">{p.meta.progress ?? 0}%</span>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete "${p.name}"? This cannot be undone.`)) onDelete(p.id);
            }}
            className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={`Delete project ${p.name}`}
          >
            {deletingId === p.id ? (
              <LoaderIcon size={12} className="animate-spin text-destructive" />
            ) : (
              <TrashIcon size={12} className="text-destructive" />
            )}
          </button>
        </div>
      ))}
    </nav>
  );
}

function EmptyState({
  projects,
  loading,
  onNewProject,
  onSelect,
  onDelete,
  deletingId,
}: {
  projects: ProjectListItem[];
  loading: boolean;
  onNewProject: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  deletingId: string;
}) {
  const hasProjects = projects.length > 0;
  return (
    <div className="flex flex-col gap-8">
      <div className="md:hidden">
        {hasProjects ? (
          <div className="rounded-2xl border border-border bg-surface p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-secondary-text">Your projects</p>
            <ProjectList projects={projects} loading={loading} selectedId={null} onSelect={onSelect} onDelete={onDelete} deletingId={deletingId} />
          </div>
        ) : (
          <Button variant="outline" className="w-full border-border bg-surface" onClick={onNewProject}>
            <PlusIcon size={14} /> Create your first project
          </Button>
        )}
      </div>

      <div className="flex flex-col items-center gap-6 py-6 text-center sm:py-10">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <FolderIcon size={32} />
        </span>
        <div className="space-y-1.5">
          <h1 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
            {hasProjects ? "Pick a project to open" : "Make something you're proud of"}
          </h1>
          <p className="mx-auto max-w-md text-sm text-secondary-text">
            Turn your wallpapers, AI generations and notes into a real showcase. Track progress,
            hit milestones, then publish it for the community to shout out.
          </p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={onNewProject}>
          <PlusIcon size={16} /> New project
        </Button>
        {!hasProjects && (
          <div className="grid w-full max-w-2xl gap-3 text-left sm:grid-cols-3">
            {[
              { icon: <ImageIcon size={18} />, title: "Collect assets", body: "Add wallpapers and AI generations you love." },
              { icon: <CheckCircleIcon size={18} />, title: "Track progress", body: "Set milestones and watch it come together." },
              { icon: <ShareIcon size={18} />, title: "Share proudly", body: "Publish a public page for the community." },
            ].map((ex) => (
              <div key={ex.title} className="rounded-xl border border-border bg-surface p-4 text-left">
                <div className="mb-2 text-primary">{ex.icon}</div>
                <p className="text-sm font-medium text-foreground">{ex.title}</p>
                <p className="mt-1 text-xs text-secondary-text">{ex.body}</p>
              </div>
            ))}
          </div>
        )}
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects/showcase">
            Explore community showcases <ArrowUpRightIcon size={14} />
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New project form
// ---------------------------------------------------------------------------

function NewProjectForm({
  onCancel,
  onSubmit,
  isSubmitting,
}: {
  onCancel: () => void;
  onSubmit: (input: { name: string; description?: string; coverUrl?: string; isPublic?: boolean }) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [coverUrl, setCoverUrl] = React.useState("");
  const [isPublic, setIsPublic] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      toast.error("Name must be 2–80 characters.");
      return;
    }
    onSubmit({
      name: trimmed,
      description: description.trim() || undefined,
      coverUrl: coverUrl.trim() || undefined,
      isPublic,
    });
  };

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border bg-surface p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-raised text-primary">
          <PlusIcon size={20} />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">Create a new project</h2>
          <p className="text-xs text-secondary-text">A home for your wallpapers, generations and ideas.</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="project-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary-text">
            Name <span className="text-destructive">*</span>
          </label>
          <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bedroom refresh — moody + gold" maxLength={80} autoFocus className="border-border bg-raised text-sm" disabled={isSubmitting} />
          <p className="mt-1 text-[11px] text-secondary-text">{name.length}/80</p>
        </div>
        <div>
          <label htmlFor="project-description" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary-text">
            Description <span className="text-secondary-text">(optional)</span>
          </label>
          <Textarea id="project-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this project about?" rows={3} maxLength={500} className="resize-none border-border bg-raised text-sm" disabled={isSubmitting} />
          <p className="mt-1 text-[11px] text-secondary-text">{description.length}/500</p>
        </div>
        <div>
          <label htmlFor="project-cover" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary-text">
            Cover image URL <span className="text-secondary-text">(optional)</span>
          </label>
          <Input id="project-cover" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" className="border-border bg-raised text-sm" disabled={isSubmitting} />
          <p className="mt-1 text-[11px] text-secondary-text">Leave blank and we'll use your first asset as the cover.</p>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-raised/40 p-3">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
          <span>
            <span className="block text-sm font-medium">Make it public now</span>
            <span className="block text-[11px] text-secondary-text">Anyone can view the showcase. You can change this later.</span>
          </span>
        </label>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting} className="text-secondary-text hover:text-foreground">Cancel</Button>
          <Button type="submit" disabled={isSubmitting || name.trim().length < 2} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {isSubmitting ? <><LoaderIcon size={16} className="animate-spin" /> Creating…</> : <><SparklesIcon size={16} /> Create project</>}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project detail — the showcase editor
// ---------------------------------------------------------------------------

function ProjectDetailView({
  project,
  onDelete,
  isDeleting,
  onPatch,
  isPatching,
  onPatchMeta,
  isPatchingMeta,
  onAddNote,
  onRemoveNote,
  isAddingNote,
  onAddAsset,
  isAddingAsset,
  onRemoveAsset,
  catalogWallpapers,
  catalogGenerations,
  catalogOpen,
  onCatalogOpen,
  onCatalogClose,
}: {
  project: ProjectDetail;
  onDelete: () => void;
  isDeleting: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
  isPatching: boolean;
  onPatchMeta: (patch: Partial<ProjectMeta>) => void;
  isPatchingMeta: boolean;
  onAddNote: (content: string) => void;
  onRemoveNote: (noteId: string) => void;
  isAddingNote: boolean;
  onAddAsset: (payload: { assetType: "wallpaper" | "generation"; wallpaperId?: string; generationId?: string; note?: string }) => void;
  isAddingAsset: boolean;
  onRemoveAsset: (assetId: string) => void;
  catalogWallpapers: CatalogWallpaper[];
  catalogGenerations: CatalogGeneration[];
  catalogOpen: boolean;
  onCatalogOpen: () => void;
  onCatalogClose: () => void;
}) {
  const meta = project.meta ?? DEFAULT_META;
  const [editing, setEditing] = React.useState(false);
  const [editName, setEditName] = React.useState(project.name);
  const [editDescription, setEditDescription] = React.useState(project.description ?? "");
  const [editCover, setEditCover] = React.useState(project.coverUrl ?? "");
  const [editPublic, setEditPublic] = React.useState(project.isPublic);
  const [milestoneTitle, setMilestoneTitle] = React.useState("");
  const [localProgress, setLocalProgress] = React.useState(meta.progress);

  React.useEffect(() => {
    setEditName(project.name);
    setEditDescription(project.description ?? "");
    setEditCover(project.coverUrl ?? "");
    setEditPublic(project.isPublic);
    setLocalProgress(meta.progress);
  }, [project.id, project.name, project.description, project.coverUrl, project.isPublic, meta.progress]);

  const hero = coverFrom(project);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/projects/${project.id}` : "";
  const completedMilestones = meta.milestones.filter((m) => m.done).length;

  const commitProgress = () => {
    if (localProgress !== meta.progress) onPatchMeta({ progress: localProgress });
  };

  const updateMilestones = (milestones: ProjectMeta["milestones"]) => onPatchMeta({ milestones });

  const addMilestone = () => {
    const title = milestoneTitle.trim();
    if (!title) return;
    updateMilestones([
      ...meta.milestones,
      { id: `m_${Date.now().toString(36)}`, title, done: false, completedAt: null },
    ]);
    setMilestoneTitle("");
    toast.success("Milestone added");
  };

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="relative h-40 sm:h-52">
          {hero ? (
            <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-surface to-surface" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
          <span className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background/70 text-primary backdrop-blur">
            <FolderIcon size={20} />
          </span>
          <div className="absolute right-4 top-4 flex gap-2">
            <Button size="sm" variant="secondary" className="gap-1.5 bg-background/70 backdrop-blur" onClick={() => {
              void navigator.clipboard?.writeText(shareUrl);
              toast.success("Share link copied");
            }}>
              <ShareIcon size={14} /> Share
            </Button>
            <Button size="sm" variant="secondary" className="gap-1.5 bg-background/70 backdrop-blur" onClick={() => setEditing((v) => !v)}>
              <SettingsIcon size={14} /> {editing ? "Done" : "Edit"}
            </Button>
          </div>
        </div>
        <div className="relative -mt-6 px-5 pb-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl font-semibold text-foreground sm:text-2xl">{project.name}</h1>
                <Badge variant="outline" className={cn("text-[10px]", STATUS_META[meta.status].className)}>{STATUS_META[meta.status].label}</Badge>
                <Badge variant="outline" className={project.isPublic ? "border-primary/30 bg-primary/10 text-[10px] text-primary" : "border-border bg-surface text-[10px] text-secondary-text"}>
                  {project.isPublic ? <><EyeIcon size={10} className="mr-1" /> Public</> : <><EyeOffIcon size={10} className="mr-1" /> Private</>}
                </Badge>
              </div>
              <p className="mt-2 max-w-2xl text-sm text-secondary-text">{project.description || "No description yet — add one in Edit."}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-secondary-text">
                <span>Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}</span>
                <span aria-hidden>·</span>
                <span>{project.assets.length} assets</span>
                <span aria-hidden>·</span>
                <span>{project.notes.length} notes</span>
                {meta.targetDate && <><span aria-hidden>·</span><span className="flex items-center gap-1"><CalendarIcon size={11} /> {new Date(meta.targetDate).toLocaleDateString()}</span></>}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete "${project.name}"? This cannot be undone.`)) onDelete(); }} disabled={isDeleting} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
              {isDeleting ? <LoaderIcon size={14} className="animate-spin" /> : <TrashIcon size={14} />} Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="rounded-2xl border border-primary/30 bg-surface p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold"><SettingsIcon size={16} className="text-primary" /> Project details</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary-text">Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={80} className="border-border bg-raised text-sm" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary-text">Cover image URL</label>
              <Input value={editCover} onChange={(e) => setEditCover(e.target.value)} placeholder="https://…" className="border-border bg-raised text-sm" />
              {project.assets.length > 0 && (
                <button type="button" className="mt-1 text-[11px] text-primary hover:underline" onClick={() => {
                  const img = coverFrom({ coverUrl: null, assets: project.assets });
                  if (img) setEditCover(img);
                }}>
                  Use first asset as cover
                </button>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary-text">Description</label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} maxLength={500} className="resize-none border-border bg-raised text-sm" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={editPublic} onChange={(e) => setEditPublic(e.target.checked)} className="size-4 accent-[var(--primary)]" />
              Public showcase
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" disabled={isPatching} className="bg-primary text-primary-foreground" onClick={() => {
                if (editName.trim().length < 2) { toast.error("Name must be at least 2 characters."); return; }
                onPatch({ name: editName.trim(), description: editDescription.trim() || null, coverUrl: editCover.trim() || null, isPublic: editPublic });
                setEditing(false);
              }}>
                {isPatching ? <LoaderIcon size={14} className="animate-spin" /> : <CheckIcon size={14} />} Save changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Progress + milestones */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-secondary-text">
            <CheckCircleIcon size={16} className="text-primary" /> Progress
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={meta.status}
              onChange={(e) => onPatchMeta({ status: e.target.value as ProjectStatus })}
              disabled={isPatchingMeta}
              className="rounded-lg border border-border bg-raised px-2.5 py-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Project status"
            >
              {(Object.keys(STATUS_META) as ProjectStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
            <Input
              type="date"
              value={meta.targetDate ?? ""}
              onChange={(e) => onPatchMeta({ targetDate: e.target.value || null })}
              disabled={isPatchingMeta}
              className="h-8 w-36 border-border bg-raised text-xs"
              aria-label="Target date"
            />
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-secondary-text">{completedMilestones} of {meta.milestones.length} milestones done</span>
            <span className="font-semibold text-primary">{localProgress}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={localProgress}
            onChange={(e) => setLocalProgress(Number(e.target.value))}
            onPointerUp={commitProgress}
            onKeyUp={commitProgress}
            className="mt-2 w-full accent-[var(--primary)]"
            aria-label="Progress percentage"
          />
        </div>

        <div className="mt-5 space-y-2">
          {meta.milestones.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-raised/40 px-3 py-2">
              <button
                type="button"
                onClick={() => updateMilestones(meta.milestones.map((x) => x.id === m.id ? { ...x, done: !x.done, completedAt: !x.done ? new Date().toISOString() : null } : x))}
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  m.done ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent hover:border-primary",
                )}
                aria-label={m.done ? "Mark milestone incomplete" : "Mark milestone complete"}
              >
                <CheckIcon size={12} />
              </button>
              <span className={cn("flex-1 text-sm", m.done ? "text-secondary-text line-through" : "text-foreground")}>{m.title}</span>
              {m.done && <CheckCircleIcon size={14} className="text-success" />}
              <button type="button" onClick={() => updateMilestones(meta.milestones.filter((x) => x.id !== m.id))} className="text-secondary-text hover:text-destructive" aria-label="Remove milestone">
                <CloseIcon size={13} />
              </button>
            </div>
          ))}
          {meta.milestones.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-secondary-text">
              No milestones yet. Add one to chart your journey.
            </p>
          )}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addMilestone(); }}>
            <Input value={milestoneTitle} onChange={(e) => setMilestoneTitle(e.target.value)} placeholder="e.g. Finalize color palette" maxLength={120} className="border-border bg-raised text-sm" />
            <Button type="submit" size="icon" disabled={!milestoneTitle.trim() || isPatchingMeta} className="shrink-0 bg-primary text-primary-foreground" aria-label="Add milestone">
              <PlusIcon size={16} />
            </Button>
          </form>
        </div>
      </section>

      {/* Assets */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-secondary-text">Assets ({project.assets.length})</h2>
          <Button size="sm" variant="outline" className="border-border bg-surface" onClick={onCatalogOpen}>
            <PlusIcon size={14} /> Add wallpaper or AI art
          </Button>
        </div>
        {project.assets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/40 p-8 text-center">
            <ImageIcon size={28} className="mx-auto mb-2 text-secondary-text" />
            <p className="text-sm text-secondary-text">No assets yet. Add wallpapers or AI generations to build your showcase.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {project.assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} onRemove={() => { if (confirm("Remove this asset from the project?")) onRemoveAsset(asset.id); }} />
            ))}
          </div>
        )}
      </section>

      {/* Notes timeline */}
      <section>
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-secondary-text">Notes &amp; timeline ({project.notes.length})</h2>
        <AddNoteForm onAdd={onAddNote} isAdding={isAddingNote} />
        {project.notes.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {project.notes.map((note) => (
              <NoteRow key={note.id} note={note} onRemove={() => onRemoveNote(note.id)} />
            ))}
          </ul>
        )}
      </section>

      {project.isPublic && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircleIcon size={18} className="text-primary" />
            <span>This showcase is public. Share it and collect shoutouts from the community.</span>
          </div>
          <Button size="sm" variant="outline" asChild className="border-primary/30 bg-surface">
            <Link href={`/projects/${project.id}`}>View public page <ArrowUpRightIcon size={14} /></Link>
          </Button>
        </div>
      )}

      {/* Add-asset catalog dialog */}
      {catalogOpen && (
        <AssetCatalogDialog
          wallpapers={catalogWallpapers}
          generations={catalogGenerations}
          onAdd={(payload) => { onAddAsset(payload); }}
          isAdding={isAddingAsset}
          onClose={onCatalogClose}
        />
      )}
    </div>
  );
}

function AssetCard({ asset, onRemove }: { asset: ProjectAsset; onRemove: () => void }) {
  const imgSrc = assetImage(asset);
  const title = asset.assetType === "generation" ? asset.generation?.prompt ?? "Generation" : asset.wallpaper?.title ?? "Wallpaper";
  const aspectClass = asset.assetType === "generation"
    ? asset.generation?.aspectRatio === "portrait" ? "aspect-[3/4]" : asset.generation?.aspectRatio === "landscape" ? "aspect-[16/9]" : "aspect-square"
    : asset.wallpaper?.orientation === "portrait" ? "aspect-[3/4]" : asset.wallpaper?.orientation === "landscape" ? "aspect-[16/9]" : "aspect-square";

  return (
    <article className="group relative overflow-hidden rounded-xl border border-border bg-surface">
      <div className={cn("relative overflow-hidden", aspectClass)}>
        {imgSrc ? (
          <img src={imgSrc} alt={title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-raised"><ImageIcon size={20} className="text-secondary-text" /></div>
        )}
        <div className="absolute right-1.5 top-1.5 flex gap-1">
          <Badge variant="outline" className="border-border bg-background/80 text-[9px] text-secondary-text backdrop-blur">
            {asset.assetType === "generation" ? "AI" : "Wallpaper"}
          </Badge>
          <button type="button" onClick={onRemove} className="rounded-md bg-background/80 p-0.5 text-secondary-text opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 hover:text-destructive" aria-label="Remove asset">
            <CloseIcon size={12} />
          </button>
        </div>
      </div>
      <div className="p-2.5">
        <p className="truncate text-xs font-medium text-foreground" title={title}>{title}</p>
        <p className="mt-0.5 text-[10px] text-secondary-text">{formatDistanceToNow(new Date(asset.createdAt), { addSuffix: true })}</p>
        {asset.note && <p className="mt-1.5 line-clamp-2 rounded-md bg-raised px-2 py-1 text-[10px] text-secondary-text">{asset.note}</p>}
      </div>
    </article>
  );
}

function AssetCatalogDialog({
  wallpapers,
  generations,
  onAdd,
  isAdding,
  onClose,
}: {
  wallpapers: CatalogWallpaper[];
  generations: CatalogGeneration[];
  onAdd: (payload: { assetType: "wallpaper" | "generation"; wallpaperId?: string; generationId?: string }) => void;
  isAdding: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = React.useState<"wallpaper" | "generation">("wallpaper");
  const [query, setQuery] = React.useState("");
  const items = tab === "wallpaper" ? wallpapers : generations;
  const filtered = items.filter((it) => {
    const text = tab === "wallpaper" ? (it as CatalogWallpaper).title : (it as CatalogGeneration).prompt;
    return text.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold">Add an asset</h2>
            <p className="text-xs text-secondary-text">Pick from your wallpapers or AI generations.</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close"><CloseIcon size={16} /></Button>
        </div>
        <div className="flex gap-2 border-b border-border px-5 py-3">
          {(["wallpaper", "generation"] as const).map((t) => (
            <Button key={t} size="sm" variant={tab === t ? "default" : "ghost"} onClick={() => setTab(t)} className={tab === t ? "bg-primary text-primary-foreground" : "text-secondary-text"}>
              {t === "wallpaper" ? "Wallpapers" : "AI generations"}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-border bg-raised px-2">
            <SearchIcon size={13} className="text-secondary-text" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="w-28 bg-transparent py-1.5 text-xs outline-none sm:w-40" />
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-4 sm:grid-cols-3">
          {filtered.length === 0 && <p className="col-span-full py-10 text-center text-xs text-secondary-text">Nothing here yet — create some first.</p>}
          {filtered.map((it) => {
            if (tab === "wallpaper") {
              const w = it as CatalogWallpaper;
              return (
                <button key={w.id} type="button" disabled={isAdding} onClick={() => onAdd({ assetType: "wallpaper", wallpaperId: w.id })} className="group overflow-hidden rounded-xl border border-border bg-raised text-left transition-colors hover:border-primary/50">
                  <div className="aspect-[4/3] overflow-hidden bg-background">
                    {w.gridAsset ? <img src={w.gridAsset.objectKey} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center text-secondary-text"><ImageIcon size={20} /></div>}
                  </div>
                  <p className="truncate px-2 py-1.5 text-[11px]">{w.title}</p>
                </button>
              );
            }
            const g = it as CatalogGeneration;
            return (
              <button key={g.id} type="button" disabled={g.status !== "completed" || isAdding} onClick={() => onAdd({ assetType: "generation", generationId: g.id })} className="group overflow-hidden rounded-xl border border-border bg-raised text-left transition-colors hover:border-primary/50 disabled:opacity-50">
                <div className="aspect-[4/3] overflow-hidden bg-background">
                  {g.publicUrl ? <img src={g.publicUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center text-secondary-text"><SparklesIcon size={20} /></div>}
                </div>
                <p className="line-clamp-2 px-2 py-1.5 text-[11px]">{g.prompt}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AddNoteForm({ onAdd, isAdding }: { onAdd: (content: string) => void; isAdding: boolean }) {
  const [content, setContent] = React.useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); const t = content.trim(); if (!t || t.length > 500) { toast.error("Note must be 1–500 characters."); return; } onAdd(t); setContent(""); }} className="rounded-xl border border-border bg-surface p-3">
      <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Add a note — design ideas, references, reminders…" rows={2} maxLength={500} className="resize-none border-0 bg-transparent px-1 text-sm focus-visible:ring-0" disabled={isAdding} aria-label="Note content" />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-secondary-text">{content.length}/500</span>
        <Button type="submit" size="sm" disabled={isAdding || content.trim().length === 0} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {isAdding ? <LoaderIcon size={14} className="animate-spin" /> : <SendIcon size={14} />} Add note
        </Button>
      </div>
    </form>
  );
}

function NoteRow({ note, onRemove }: { note: ProjectNote; onRemove: () => void }) {
  return (
    <div className="group flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-raised text-primary"><SparklesIcon size={12} /></span>
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">{note.content}</p>
        <p className="mt-1 text-[10px] text-secondary-text">{formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</p>
      </div>
      <button type="button" onClick={onRemove} className="text-secondary-text opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100" aria-label="Remove note"><TrashIcon size={13} /></button>
    </div>
  );
}
