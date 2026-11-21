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
} from "@/components/icons/wallora-icons";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types — mirror the API contract.
// ---------------------------------------------------------------------------

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

type ProjectNote = {
  id: string;
  content: string;
  createdAt: string;
};

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
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProjectsPage() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-background">
        <LoaderIcon
          size={24}
          className="text-primary"
          style={{ animation: "spin 1s linear infinite" }}
        />
        <span className="sr-only">Loading projects…</span>
      </div>
    );
  }

  if (status !== "authenticated") {
    return <SignedOutState />;
  }

  return <ProjectsWorkspace />;
}

// ---------------------------------------------------------------------------
// Auth-gate state
// ---------------------------------------------------------------------------

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
            Projects bundle wallpapers, AI generations and notes into private
            moodboards. Authenticate to create and curate your collections.
          </p>
        </div>
        <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/">
            <SparklesIcon size={16} />
            Go to home
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workspace — sidebar + main area
// ---------------------------------------------------------------------------

function ProjectsWorkspace() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showNewForm, setShowNewForm] = React.useState(false);
  const [mobileListOpen, setMobileListOpen] = React.useState(false);

  // Collapse the "new project" form whenever a project is opened.
  React.useEffect(() => {
    if (selectedId) setShowNewForm(false);
  }, [selectedId]);

  // ------------------------- Queries -------------------------
  const { data: projectsData, isLoading: loadingList } = useQuery<{ data: ProjectListItem[] }>({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/v1/projects");
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });
  const projects = projectsData?.data ?? [];

  const { data: detailData, isLoading: loadingDetail } = useQuery<{ data: ProjectDetail }>({
    queryKey: ["project", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/projects/${selectedId}`);
      if (!res.ok) throw new Error("Failed to load project");
      return res.json();
    },
    enabled: !!selectedId,
  });
  const project = detailData?.data;

  // ------------------------- Mutations -------------------------
  const createMutation = useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
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
      toast.success("Project created", { description: data.data.name });
    },
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
      queryClient.invalidateQueries({ queryKey: ["project", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Note added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleNewProject = () => {
    setSelectedId(null);
    setShowNewForm(true);
    setMobileListOpen(false);
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setShowNewForm(false);
    setMobileListOpen(false);
  };

  const deletingIdRef = deleteMutation.isPending ? selectedId ?? "" : "";

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* ---------------- Desktop sidebar ---------------- */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-surface/40 md:flex">
        <SidebarHeader />
        <div className="border-b border-border p-3">
          <Button
            className="w-full justify-start bg-primary/15 text-primary hover:bg-primary/25"
            variant="ghost"
            onClick={handleNewProject}
          >
            <PlusIcon size={16} />
            New project
          </Button>
        </div>
        <ProjectList
          projects={projects}
          loading={loadingList}
          selectedId={selectedId}
          onSelect={handleSelect}
          onDelete={(id) => deleteMutation.mutate(id)}
          deletingId={deletingIdRef}
        />
      </aside>

      {/* ---------------- Main area ---------------- */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            {selectedId && !showNewForm ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setSelectedId(null)}
                aria-label="Back to projects"
              >
                <ArrowLeftIcon size={16} />
              </Button>
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface text-primary">
                <FolderIcon size={16} />
              </span>
            )}
            <span className="font-display text-sm font-semibold text-foreground">
              {selectedId && project
                ? project.name
                : showNewForm
                  ? "New project"
                  : "Projects"}
            </span>
          </div>
          {!selectedId && !showNewForm && (
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleNewProject}
            >
              <PlusIcon size={14} />
              New
            </Button>
          )}
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
            {showNewForm ? (
              <NewProjectForm
                onCancel={() => setShowNewForm(false)}
                onSubmit={(input) => createMutation.mutate(input)}
                isSubmitting={createMutation.isPending}
              />
            ) : selectedId ? (
              loadingDetail || !project ? (
                <div className="flex h-64 items-center justify-center">
                  <LoaderIcon
                    size={24}
                    className="text-primary"
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                  <span className="sr-only">Loading project…</span>
                </div>
              ) : (
                <ProjectDetail
                  project={project}
                  onBack={() => setSelectedId(null)}
                  onDelete={() => deleteMutation.mutate(project.id)}
                  isDeleting={deleteMutation.isPending}
                  onAddNote={(content) =>
                    addNoteMutation.mutate({ projectId: project.id, content })
                  }
                  isAddingNote={addNoteMutation.isPending}
                />
              )
            ) : (
              <EmptyState
                projects={projects}
                loading={loadingList}
                onNewProject={handleNewProject}
                onSelect={handleSelect}
                onDelete={(id) => deleteMutation.mutate(id)}
                deletingId={deletingIdRef}
                selectedId={selectedId}
                mobileListOpen={mobileListOpen}
                setMobileListOpen={setMobileListOpen}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar header
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
          <span className="text-[10px] text-secondary-text">Private collections</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project list (shared by sidebar + mobile)
// ---------------------------------------------------------------------------

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
        <LoaderIcon
          size={20}
          className="text-secondary-text"
          style={{ animation: "spin 1s linear infinite" }}
        />
        <span className="sr-only">Loading projects…</span>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center gap-2 p-6 text-center">
        <FolderIcon size={28} className="text-secondary-text" />
        <p className="text-xs text-secondary-text">
          No projects yet.
          <br />
          Create your first to get started.
        </p>
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
            "group mb-1 cursor-pointer rounded-lg px-3 py-2.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            selectedId === p.id
              ? "bg-raised text-foreground"
              : "text-secondary-text hover:bg-surface hover:text-foreground",
          )}
          onClick={() => onSelect(p.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(p.id);
            }
          }}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-primary">
              <FolderIcon size={12} />
            </span>
            <span className="flex-1 truncate text-xs font-medium">{p.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (
                  confirm(
                    `Delete "${p.name}"? This removes the project and all its assets and notes. This cannot be undone.`,
                  )
                ) {
                  onDelete(p.id);
                }
              }}
              className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={`Delete project ${p.name}`}
            >
              {deletingId === p.id ? (
                <LoaderIcon
                  size={12}
                  className="text-destructive"
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                <TrashIcon size={12} className="text-destructive" />
              )}
            </button>
          </div>
          <div className="mt-1 flex items-center gap-2 pl-8 text-[10px] text-secondary-text">
            <span>{p.assetCount} assets</span>
            <span aria-hidden>·</span>
            <span>{p.noteCount} notes</span>
          </div>
        </div>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Empty state (desktop) — also embeds the mobile project picker
// ---------------------------------------------------------------------------

const EXAMPLE_PROJECTS = [
  {
    icon: "🛏️",
    title: "Bedroom refresh",
    body: "A moodboard for a moody, gold-accented bedroom redo.",
  },
  {
    icon: "🌃",
    title: "Cyberpunk city",
    body: "Collect neon rain-soaked skylines for a wallpaper pack.",
  },
  {
    icon: "⛰️",
    title: "Mountain series",
    body: "Reference photos + generations for a landscape series.",
  },
];

function EmptyState({
  projects,
  loading,
  onNewProject,
  onSelect,
  onDelete,
  deletingId,
  selectedId,
  mobileListOpen,
  setMobileListOpen,
}: {
  projects: ProjectListItem[];
  loading: boolean;
  onNewProject: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  deletingId: string;
  selectedId: string | null;
  mobileListOpen: boolean;
  setMobileListOpen: (open: boolean) => void;
}) {
  const hasProjects = projects.length > 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Mobile: inline project picker when no project is selected */}
      <div className="md:hidden">
        {mobileListOpen || hasProjects ? (
          <div className="rounded-2xl border border-border bg-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-secondary-text">
                Your projects
              </span>
              {hasProjects && (
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={onNewProject}
                >
                  <PlusIcon size={14} />
                  New
                </Button>
              )}
            </div>
            {hasProjects ? (
              <ProjectList
                projects={projects}
                loading={loading}
                selectedId={selectedId}
                onSelect={onSelect}
                onDelete={onDelete}
                deletingId={deletingId}
              />
            ) : (
              <p className="px-3 py-6 text-center text-xs text-secondary-text">
                No projects yet. Tap “New” to create one.
              </p>
            )}
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full border-border bg-surface text-secondary-text hover:text-foreground"
            onClick={() => setMobileListOpen(true)}
          >
            Browse projects
          </Button>
        )}
      </div>

      {/* Hero empty state */}
      <div className="flex flex-col items-center gap-6 py-6 text-center sm:py-10">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <FolderIcon size={32} />
        </span>
        <div className="space-y-1.5">
          <h1 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
            {hasProjects ? "Pick a project to open" : "Create your first project"}
          </h1>
          <p className="mx-auto max-w-md text-sm text-secondary-text">
            Projects bundle wallpapers, AI generations and notes into private
            moodboards. Use them to plan a room refresh, collect references, or
            curate a wallpaper pack.
          </p>
        </div>

        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={onNewProject}
        >
          <PlusIcon size={16} />
          New project
        </Button>

        <div className="grid w-full max-w-2xl gap-3 text-left sm:grid-cols-3">
          {EXAMPLE_PROJECTS.map((ex) => (
            <button
              key={ex.title}
              type="button"
              onClick={onNewProject}
              className="rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-primary/30"
            >
              <div className="mb-2 text-2xl" aria-hidden>
                {ex.icon}
              </div>
              <p className="text-sm font-medium text-foreground">{ex.title}</p>
              <p className="mt-1 text-xs text-secondary-text">{ex.body}</p>
            </button>
          ))}
        </div>

        <Badge variant="outline" className="border-border bg-surface text-[10px] text-secondary-text">
          Creative Projects
        </Badge>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New project — inline form
// ---------------------------------------------------------------------------

function NewProjectForm({
  onCancel,
  onSubmit,
  isSubmitting,
}: {
  onCancel: () => void;
  onSubmit: (input: { name: string; description?: string }) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      toast.error("Name must be 2–80 characters.");
      return;
    }
    onSubmit({ name: trimmed, description: description.trim() || undefined });
  };

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border bg-surface p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-raised text-primary">
          <PlusIcon size={20} />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            Create a new project
          </h2>
          <p className="text-xs text-secondary-text">
            A workspace for wallpapers, generations and notes.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="project-name"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary-text"
          >
            Name <span className="text-destructive">*</span>
          </label>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bedroom refresh — moody + gold"
            maxLength={80}
            autoFocus
            className="border-border bg-raised text-sm"
            disabled={isSubmitting}
          />
          <p className="mt-1 text-[11px] text-secondary-text">{name.length}/80</p>
        </div>

        <div>
          <label
            htmlFor="project-description"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary-text"
          >
            Description{" "}
            <span className="text-secondary-text">(optional)</span>
          </label>
          <Textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project about?"
            rows={4}
            maxLength={500}
            className="resize-none border-border bg-raised text-sm"
            disabled={isSubmitting}
          />
          <p className="mt-1 text-[11px] text-secondary-text">{description.length}/500</p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
            className="text-secondary-text hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || name.trim().length < 2}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSubmitting ? (
              <>
                <LoaderIcon
                  size={16}
                  style={{ animation: "spin 1s linear infinite" }}
                />
                Creating…
              </>
            ) : (
              <>
                <SparklesIcon size={16} />
                Create project
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project detail — header + assets grid + notes
// ---------------------------------------------------------------------------

function ProjectDetail({
  project,
  onBack,
  onDelete,
  isDeleting,
  onAddNote,
  isAddingNote,
}: {
  project: ProjectDetail;
  onBack: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  onAddNote: (content: string) => void;
  isAddingNote: boolean;
}) {
  const handleDelete = () => {
    if (
      confirm(
        `Delete "${project.name}"? This removes the project and all its assets and notes. This cannot be undone.`,
      )
    ) {
      onDelete();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header card */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-raised text-primary">
                <FolderIcon size={16} />
              </span>
              <h1 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
                {project.name}
              </h1>
              <Badge
                variant="outline"
                className={
                  project.isPublic
                    ? "border-success/30 bg-success/10 text-[10px] text-success"
                    : "border-border bg-surface text-[10px] text-secondary-text"
                }
              >
                {project.isPublic ? "Public" : "Private"}
              </Badge>
            </div>
            {project.description ? (
              <p className="text-sm text-secondary-text">{project.description}</p>
            ) : (
              <p className="text-xs italic text-secondary-text">No description yet.</p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-secondary-text">
              <span>
                Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
              </span>
              <span aria-hidden>·</span>
              <span>{project.assets.length} assets</span>
              <span aria-hidden>·</span>
              <span>{project.notes.length} notes</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {isDeleting ? (
                <LoaderIcon
                  size={14}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                <TrashIcon size={14} />
              )}
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Assets */}
      <section aria-labelledby="assets-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2
            id="assets-heading"
            className="font-display text-sm font-semibold uppercase tracking-wider text-secondary-text"
          >
            Assets ({project.assets.length})
          </h2>
        </div>
        {project.assets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/40 p-8 text-center">
            <ImageIcon size={28} className="mx-auto mb-2 text-secondary-text" />
            <p className="text-sm text-secondary-text">
              No assets yet. Add wallpapers or AI generations from their detail views.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {project.assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        )}
      </section>

      {/* Divider */}
      <div className="h-px w-full bg-border" role="separator" aria-orientation="horizontal" />

      {/* Notes */}
      <section aria-labelledby="notes-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2
            id="notes-heading"
            className="font-display text-sm font-semibold uppercase tracking-wider text-secondary-text"
          >
            Notes ({project.notes.length})
          </h2>
        </div>
        <AddNoteForm onAdd={onAddNote} isAdding={isAddingNote} />
        {project.notes.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {project.notes.map((note) => (
              <li key={note.id}>
                <NoteRow note={note} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Mobile back */}
      <div className="pt-2 md:hidden">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-secondary-text hover:text-foreground"
        >
          <ArrowLeftIcon size={16} />
          Back to projects
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Asset card
// ---------------------------------------------------------------------------

function AssetCard({ asset }: { asset: ProjectAsset }) {
  const imgSrc =
    asset.assetType === "generation"
      ? asset.generation?.publicUrl
      : asset.wallpaper?.gridAsset?.objectKey;
  const title =
    asset.assetType === "generation"
      ? asset.generation?.prompt ?? "Generation"
      : asset.wallpaper?.title ?? "Wallpaper";

  const aspectClass =
    asset.assetType === "generation"
      ? asset.generation?.aspectRatio === "portrait"
        ? "aspect-[3/4]"
        : asset.generation?.aspectRatio === "landscape"
          ? "aspect-[16/9]"
          : "aspect-square"
      : asset.wallpaper?.orientation === "portrait"
        ? "aspect-[3/4]"
        : asset.wallpaper?.orientation === "landscape"
          ? "aspect-[16/9]"
          : "aspect-square";

  return (
    <article className="group relative overflow-hidden rounded-xl border border-border bg-surface">
      <div className={cn("relative overflow-hidden", aspectClass)}>
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-raised">
            <ImageIcon size={20} className="text-secondary-text" />
          </div>
        )}
        <div className="absolute right-1.5 top-1.5">
          <Badge
            variant="outline"
            className="border-border bg-background/80 text-[9px] text-secondary-text backdrop-blur"
          >
            {asset.assetType === "generation" ? "AI" : "Wallpaper"}
          </Badge>
        </div>
      </div>
      <div className="p-2.5">
        <p className="truncate text-xs font-medium text-foreground" title={title}>
          {title}
        </p>
        <p className="mt-0.5 text-[10px] text-secondary-text">
          {formatDistanceToNow(new Date(asset.createdAt), { addSuffix: true })}
        </p>
        {asset.note && (
          <p className="mt-1.5 line-clamp-2 rounded-md bg-raised px-2 py-1 text-[10px] text-secondary-text">
            {asset.note}
          </p>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Add note form
// ---------------------------------------------------------------------------

function AddNoteForm({
  onAdd,
  isAdding,
}: {
  onAdd: (content: string) => void;
  isAdding: boolean;
}) {
  const [content, setContent] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (trimmed.length < 1 || trimmed.length > 500) {
      toast.error("Note must be 1–500 characters.");
      return;
    }
    onAdd(trimmed);
    setContent("");
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-3">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add a note — design ideas, references, reminders…"
        rows={2}
        maxLength={500}
        className="resize-none border-0 bg-transparent px-1 text-sm focus-visible:ring-0"
        disabled={isAdding}
        aria-label="Note content"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-secondary-text">{content.length}/500</span>
        <Button
          type="submit"
          size="sm"
          disabled={isAdding || content.trim().length === 0}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isAdding ? (
            <LoaderIcon
              size={14}
              style={{ animation: "spin 1s linear infinite" }}
            />
          ) : (
            <SendIcon size={14} />
          )}
          Add note
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Note row
// ---------------------------------------------------------------------------

function NoteRow({ note }: { note: ProjectNote }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-raised text-primary">
        <SparklesIcon size={12} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">{note.content}</p>
        <p className="mt-1 text-[10px] text-secondary-text">
          {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}
