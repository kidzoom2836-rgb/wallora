"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Plus,
  FolderKanban,
  FolderPlus,
  Loader2,
  Trash2,
  ImageIcon,
  PencilLine,
  StickyNote,
  ArrowLeft,
  Sparkles,
  Lock,
  Globe,
  Calendar,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { WalloraMonogram } from "@/components/brand/wallora-logo";
import { useProjects } from "@/stores/projects";
import { useAuthDialog } from "@/stores/auth-dialog";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
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
// Main component
// ---------------------------------------------------------------------------

export function ProjectsPanel() {
  const { open, setOpen, selectedProjectId, setSelectedProjectId } = useProjects();
  const openSignIn = useAuthDialog((s) => s.openSignIn);
  const { status } = useSession();

  // If the user signs out while the panel is open, close it.
  React.useEffect(() => {
    if (open && status === "unauthenticated") {
      setOpen(false);
    }
  }, [open, status, setOpen]);

  // Esc to close.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  // Lock scroll while open.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // If not authenticated, surface sign-in instead of the panel.
  const handleOpenChange = (next: boolean) => {
    if (next && status !== "authenticated") {
      openSignIn();
      return;
    }
    setOpen(next);
    if (!next) {
      // Clear selection on close so reopening shows the sidebar / empty state.
      setSelectedProjectId(null);
    }
  };

  return (
    <AnimatePresence>
      {open && status === "authenticated" && (
        <ProjectsPanelInner
          onClose={() => handleOpenChange(false)}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={setSelectedProjectId}
        />
      )}
    </AnimatePresence>
  );
}

function ProjectsPanelInner({
  onClose,
  selectedProjectId,
  setSelectedProjectId,
}: {
  onClose: () => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [showNewProjectForm, setShowNewProjectForm] = React.useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);

  // Reset the "new project" form when the panel closes/opens.
  React.useEffect(() => {
    if (!selectedProjectId) setShowNewProjectForm(false);
  }, [selectedProjectId]);

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

  const { data: projectDetail, isLoading: loadingDetail } = useQuery<{ data: ProjectDetail }>({
    queryKey: ["project", selectedProjectId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/projects/${selectedProjectId}`);
      if (!res.ok) throw new Error("Failed to load project");
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  // ------------------------- Mutations -------------------------
  const createProjectMutation = useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      const res = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Failed to create project");
      }
      return json as { data: ProjectListItem; message: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setShowNewProjectForm(false);
      setSelectedProjectId(data.data.id);
      toast.success("Project created", { description: data.data.name });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      description?: string | null;
    }) => {
      const res = await fetch(`/api/v1/projects/${input.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: input.name,
          description: input.description ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Failed to update project");
      }
      return json as { data: ProjectDetail };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project", selectedProjectId] });
      toast.success("Project updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/projects/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Failed to delete project");
      }
      return json;
    },
    onSuccess: (_data, deletedId) => {
      if (selectedProjectId === deletedId) setSelectedProjectId(null);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project", deletedId] });
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
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Failed to add note");
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ------------------------- Render -------------------------
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex bg-background/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Creative projects"
    >
      {/* Sidebar (desktop) */}
      <aside className="hidden w-80 shrink-0 flex-col border-r border-border bg-surface/60 lg:flex">
        <SidebarHeader onClose={onClose} />
        <div className="border-b border-border p-3">
          <Button
            className="w-full justify-start bg-primary/15 text-primary hover:bg-primary/25"
            variant="ghost"
            onClick={() => {
              setSelectedProjectId(null);
              setShowNewProjectForm(true);
            }}
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            New project
          </Button>
        </div>
        <ProjectList
          projects={projects}
          loading={loadingList}
          selectedId={selectedProjectId}
          onSelect={(id) => {
            setSelectedProjectId(id);
            setShowNewProjectForm(false);
          }}
          onDelete={(id) => deleteProjectMutation.mutate(id)}
          deletingId={deleteProjectMutation.isPending ? selectedProjectId ?? "" : ""}
        />
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile header */}
        <header className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            {selectedProjectId ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => {
                  setSelectedProjectId(null);
                  setMobileSidebarOpen(true);
                }}
                aria-label="Back to projects"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : (
              <WalloraMonogram className="h-7 w-7" />
            )}
            <span className="font-display text-sm font-semibold">Projects</span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onClose}
            aria-label="Close projects panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        {/* Mobile project picker (Sheet-style overlay) */}
        <AnimatePresence>
          {mobileSidebarOpen && !selectedProjectId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex flex-col bg-background lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="font-display text-sm font-semibold">Your projects</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setMobileSidebarOpen(false)}
                  aria-label="Close project list"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="border-b border-border p-3">
                <Button
                  className="w-full justify-start bg-primary/15 text-primary hover:bg-primary/25"
                  variant="ghost"
                  onClick={() => {
                    setShowNewProjectForm(true);
                    setMobileSidebarOpen(false);
                  }}
                >
                  <FolderPlus className="mr-2 h-4 w-4" />
                  New project
                </Button>
              </div>
              <ProjectList
                projects={projects}
                loading={loadingList}
                selectedId={selectedProjectId}
                onSelect={(id) => {
                  setSelectedProjectId(id);
                  setMobileSidebarOpen(false);
                  setShowNewProjectForm(false);
                }}
                onDelete={(id) => deleteProjectMutation.mutate(id)}
                deletingId=""
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Desktop header */}
        <header className="hidden items-center justify-between border-b border-border px-6 py-4 lg:flex">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-primary">
              <FolderKanban className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">
                Creative Projects
              </h2>
              <p className="text-xs text-secondary-text">
                Curate wallpapers + generations into private collections.
              </p>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onClose}
            aria-label="Close projects panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl p-4 sm:p-6">
            <AnimatePresence mode="wait">
              {showNewProjectForm && !selectedProjectId ? (
                <motion.div
                  key="new-project"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                >
                  <NewProjectForm
                    onCancel={() => setShowNewProjectForm(false)}
                    onSubmit={(input) => createProjectMutation.mutate(input)}
                    isSubmitting={createProjectMutation.isPending}
                  />
                </motion.div>
              ) : selectedProjectId && projectDetail?.data ? (
                <motion.div
                  key={`project-${selectedProjectId}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                >
                  <ProjectDetail
                    project={projectDetail.data}
                    onBack={() => setSelectedProjectId(null)}
                    onUpdate={(input) =>
                      updateProjectMutation.mutate({ id: selectedProjectId, ...input })
                    }
                    isUpdating={updateProjectMutation.isPending}
                    onDelete={() => deleteProjectMutation.mutate(selectedProjectId)}
                    isDeleting={deleteProjectMutation.isPending}
                    onAddNote={(content) =>
                      addNoteMutation.mutate({ projectId: selectedProjectId, content })
                    }
                    isAddingNote={addNoteMutation.isPending}
                  />
                </motion.div>
              ) : selectedProjectId && loadingDetail ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex h-64 items-center justify-center"
                >
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                >
                  <EmptyState
                    hasProjects={projects.length > 0}
                    onNewProject={() => setShowNewProjectForm(true)}
                    onOpenMobileList={() => setMobileSidebarOpen(true)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function SidebarHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-border p-4">
      <div className="flex items-center gap-2">
        <WalloraMonogram className="h-7 w-7" />
        <span className="font-display text-sm font-semibold">Projects</span>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={onClose}
        aria-label="Close projects panel"
      >
        <X className="h-4 w-4" />
      </Button>
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
        <Loader2 className="h-5 w-5 animate-spin text-secondary-text" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center gap-2 p-6 text-center">
        <FolderKanban className="h-8 w-8 text-secondary-text" />
        <p className="text-xs text-secondary-text">
          No projects yet.
          <br />
          Create your first to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-2">
      {projects.map((p) => (
        <div
          key={p.id}
          className={cn(
            "group mb-1 cursor-pointer rounded-lg px-3 py-2.5 transition-colors",
            selectedId === p.id
              ? "bg-raised text-foreground"
              : "text-secondary-text hover:bg-surface hover:text-foreground",
          )}
          onClick={() => onSelect(p.id)}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-primary">
              {p.isPublic ? (
                <Globe className="h-3 w-3" />
              ) : (
                <Lock className="h-3 w-3" />
              )}
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
              className="opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Delete project"
            >
              {deletingId === p.id ? (
                <Loader2 className="h-3 w-3 animate-spin text-destructive" />
              ) : (
                <Trash2 className="h-3 w-3 text-destructive" />
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
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-raised text-primary">
          <FolderPlus className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            Create a new project
          </h3>
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
            Description <span className="text-secondary-text">(optional)</span>
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
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
// Empty state (no project selected)
// ---------------------------------------------------------------------------

const EXAMPLE_PROMPTS = [
  {
    icon: "🛏️",
    title: "Bedroom refresh",
    body: "A moodboard for a moody, gold-accented bedroom redo.",
  },
  {
    icon: "🌃",
    title: "Cyberpunk city",
    body: "Collect neon rain-soaked skylines for a desktop wallpaper pack.",
  },
  {
    icon: "⛰️",
    title: "Mountain series",
    body: "Reference photos + generations for a landscape series.",
  },
];

function EmptyState({
  hasProjects,
  onNewProject,
  onOpenMobileList,
}: {
  hasProjects: boolean;
  onNewProject: () => void;
  onOpenMobileList: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center sm:py-16">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <FolderKanban className="h-8 w-8" />
      </span>
      <div>
        <h3 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
          {hasProjects ? "Pick a project to open" : "Create your first project"}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-secondary-text">
          Projects bundle wallpapers, AI generations and notes into private
          moodboards. Use them to plan a room refresh, collect references, or
          curate a wallpaper pack.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={onNewProject}
        >
          <FolderPlus className="mr-2 h-4 w-4" />
          New project
        </Button>
        {hasProjects && (
          <Button
            variant="outline"
            className="border-border bg-surface text-secondary-text hover:text-foreground lg:hidden"
            onClick={onOpenMobileList}
          >
            View all projects
          </Button>
        )}
      </div>

      <div className="grid w-full max-w-2xl gap-3 text-left sm:grid-cols-3">
        {EXAMPLE_PROMPTS.map((ex) => (
          <button
            key={ex.title}
            type="button"
            onClick={onNewProject}
            className="rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-primary/30"
          >
            <div className="mb-2 text-2xl">{ex.icon}</div>
            <p className="text-sm font-medium text-foreground">{ex.title}</p>
            <p className="mt-1 text-xs text-secondary-text">{ex.body}</p>
          </button>
        ))}
      </div>

      <Badge variant="outline" className="border-border bg-surface text-[10px] text-secondary-text">
        Phase 7 · Creative Projects
      </Badge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project detail view
// ---------------------------------------------------------------------------

function ProjectDetail({
  project,
  onBack,
  onUpdate,
  isUpdating,
  onDelete,
  isDeleting,
  onAddNote,
  isAddingNote,
}: {
  project: ProjectDetail;
  onBack: () => void;
  onUpdate: (input: { name?: string; description?: string | null }) => void;
  isUpdating: boolean;
  onDelete: () => void;
  isDeleting: boolean;
  onAddNote: (content: string) => void;
  isAddingNote: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draftName, setDraftName] = React.useState(project.name);
  const [draftDescription, setDraftDescription] = React.useState(project.description ?? "");

  React.useEffect(() => {
    setDraftName(project.name);
    setDraftDescription(project.description ?? "");
  }, [project.id, project.name, project.description]);

  const handleSave = () => {
    const name = draftName.trim();
    if (name.length < 2 || name.length > 80) {
      toast.error("Name must be 2–80 characters.");
      return;
    }
    onUpdate({ name, description: draftDescription.trim() || null });
    setEditing(false);
  };

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
      {/* Header / title */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {editing ? (
              <div className="flex flex-col gap-3">
                <Input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  maxLength={80}
                  className="border-border bg-raised text-base font-semibold"
                  autoFocus
                />
                <Textarea
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={3}
                  maxLength={500}
                  className="resize-none border-border bg-raised text-sm"
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isUpdating}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isUpdating ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(false);
                      setDraftName(project.name);
                      setDraftDescription(project.description ?? "");
                    }}
                    disabled={isUpdating}
                    className="text-secondary-text"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
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
                    {project.isPublic ? (
                      <>
                        <Globe className="mr-1 h-2.5 w-2.5" />
                        Public
                      </>
                    ) : (
                      <>
                        <Lock className="mr-1 h-2.5 w-2.5" />
                        Private
                      </>
                    )}
                  </Badge>
                </div>
                {project.description ? (
                  <p className="text-sm text-secondary-text">{project.description}</p>
                ) : (
                  <p className="text-xs italic text-secondary-text">No description yet.</p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-secondary-text">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                  </span>
                  <span aria-hidden>·</span>
                  <span>{project.assets.length} assets</span>
                  <span aria-hidden>·</span>
                  <span>{project.notes.length} notes</span>
                </div>
              </>
            )}
          </div>

          {!editing && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
                className="border-border bg-raised text-secondary-text hover:text-foreground"
              >
                <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {isDeleting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                Delete
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Assets grid */}
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
            <ImageIcon className="mx-auto mb-2 h-8 w-8 text-secondary-text" />
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

      <Separator className="bg-border" />

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
          <div className="mt-4 flex flex-col gap-2">
            {project.notes.map((note) => (
              <NoteRow key={note.id} note={note} />
            ))}
          </div>
        )}
      </section>

      {/* Mobile back */}
      <div className="pt-2 lg:hidden">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-secondary-text hover:text-foreground"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
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
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="group relative overflow-hidden rounded-xl border border-border bg-surface"
    >
      <div className={cn("relative overflow-hidden", aspectClass)}>
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-raised">
            <ImageIcon className="h-6 w-6 text-secondary-text" />
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
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Notes
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
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="mr-1.5 h-3.5 w-3.5" />
          )}
          Add note
        </Button>
      </div>
    </form>
  );
}

function NoteRow({ note }: { note: ProjectNote }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-raised text-primary">
        <StickyNote className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">{note.content}</p>
        <p className="mt-1 text-[10px] text-secondary-text">
          {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
        </p>
      </div>
    </motion.div>
  );
}
