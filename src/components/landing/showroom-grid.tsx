"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Check,
  FolderOpen,
  ImageIcon,
  LayoutGrid,
  Loader2,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { VerifiedTick } from "@/components/brand/verified-badge";
import { useAuthDialog } from "@/stores/auth-dialog";
import { useVerificationGate } from "@/components/verification/verification-gate";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type Tier = "free" | "verified" | "premium" | "supreme";

export type ShowroomItemView = {
  id: string;
  type: "wallpaper" | "project" | "image";
  title: string;
  imageUrl: string | null;
  href: string | null;
  wallpaperSlug?: string | null;
  projectId?: string | null;
  caption: string;
  createdAt: string;
};

export type ShowroomOwnerView = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  tier: Tier;
  userId: string | null;
};

export type ShowroomView = {
  username: string;
  headline: string;
  description: string;
  updatedAt: string;
  itemCount: number;
  owner: ShowroomOwnerView;
  items: ShowroomItemView[];
};

type ListResponse = {
  data: {
    items: ShowroomView[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  };
};

type PickerWallpaper = {
  slug: string;
  title: string;
  asset: { objectKey: string } | null;
};

type PickerProject = {
  id: string;
  name: string;
  coverUrl: string | null;
};

export type SelectedShowroomItem = {
  id: string;
  wallpaperSlug?: string;
  projectId?: string;
  imageUrl?: string;
  caption: string;
  image: string | null;
};

/** Gallery of real curated showrooms, with a gated creation editor. */
export function ShowroomGrid({ showHeading = true }: { showHeading?: boolean }) {
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [editorOpen, setEditorOpen] = React.useState(false);
  const { guard } = useVerificationGate();
  const { data: session, status } = useSession();
  const openSignIn = useAuthDialog((s) => s.openSignIn);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const listQuery = useQuery<ListResponse>({
    queryKey: ["showroom-list", debounced],
    queryFn: async () => {
      const res = await fetch(`/api/v1/showroom?q=${encodeURIComponent(debounced)}&limit=36`);
      if (!res.ok) throw new Error("Failed to load showrooms");
      return res.json();
    },
  });

  const items = listQuery.data?.data.items ?? [];

  const openEditor = () =>
    guard(
      () => {
        if (status !== "authenticated") {
          openSignIn();
          return;
        }
        setEditorOpen(true);
      },
      { action: "create your showroom" },
    );

  return (
    <section className="relative border-b border-border bg-background py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          {showHeading && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                Showroom
              </p>
              <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
                Curated by the community
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary-text">
                Real galleries built from approved wallpapers and public projects. Open one,
                explore the work, and feature your favourites in your own showroom.
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3">
              <Search className="size-4 shrink-0 text-secondary-text" aria-hidden />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search showrooms"
                aria-label="Search showrooms"
                className="h-9 w-40 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 sm:w-56"
              />
            </div>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openEditor}>
              <Plus className="size-4" />
              Create your showroom
            </Button>
          </div>
        </div>

        <div className="mt-8">
          {listQuery.isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="overflow-hidden rounded-2xl border border-border bg-surface">
                  <Skeleton className="h-44 w-full rounded-none bg-raised" />
                  <div className="space-y-2 p-4">
                    <Skeleton className="h-4 w-2/3 bg-raised" />
                    <Skeleton className="h-3 w-full bg-raised" />
                  </div>
                </div>
              ))}
            </div>
          ) : listQuery.isError ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface/40 py-16 text-center">
              <p className="text-sm text-secondary-text">Couldn&apos;t load showrooms.</p>
              <Button size="sm" className="mt-3" onClick={() => void listQuery.refetch()}>Try again</Button>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface/40 py-16 text-center">
              <LayoutGrid className="mx-auto size-8 text-secondary-text" />
              <p className="mt-3 text-sm text-secondary-text">No showrooms match that search.</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((showroom) => (
                <ShowroomCard key={showroom.username} showroom={showroom} />
              ))}
            </div>
          )}
        </div>
      </div>

      <ShowroomEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        existing={items.find((item) => item.owner.userId && item.owner.userId === session?.user?.id) ?? null}
      />
    </section>
  );
}

function ShowroomCard({ showroom }: { showroom: ShowroomView }) {
  const ownerName = showroom.owner.displayName ?? showroom.owner.username;
  const initial = ownerName.charAt(0).toUpperCase();

  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-primary/40">
      <div className="relative grid h-44 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden bg-raised">
        {showroom.items.length > 0 ? (
          showroom.items.slice(0, 4).map((item) => (
            <Link
              key={item.id}
              href={item.href ?? `/showroom/${showroom.username}`}
              className="relative overflow-hidden"
              aria-label={item.title}
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <span className="flex size-full items-center justify-center bg-raised text-secondary-text">
                  <ImageIcon className="size-5" />
                </span>
              )}
            </Link>
          ))
        ) : (
          <Link
            href={`/showroom/${showroom.username}`}
            className="col-span-2 row-span-2 flex items-center justify-center bg-gradient-to-br from-primary/15 via-surface to-raised text-primary"
          >
            <LayoutGrid className="size-8" />
          </Link>
        )}
        <span className="pointer-events-none absolute bottom-2 right-2 rounded-full border border-border bg-background/85 px-2 py-0.5 text-[10px] font-medium text-foreground backdrop-blur">
          {showroom.itemCount} {showroom.itemCount === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="p-4">
        <Link href={`/showroom/${showroom.username}`} className="flex items-start justify-between gap-2">
          <h2 className="line-clamp-1 font-display text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
            {showroom.headline}
          </h2>
          <ArrowUpRight className="size-4 shrink-0 text-secondary-text transition-colors group-hover:text-primary" />
        </Link>
        <p className="mt-1 line-clamp-2 min-h-[2rem] text-xs leading-relaxed text-secondary-text">
          {showroom.description}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Link
            href={`/profile/${showroom.owner.username}`}
            className="flex min-w-0 items-center gap-2 text-xs text-secondary-text hover:text-foreground"
          >
            <Avatar className="size-6 border border-border">
              <AvatarImage src={showroom.owner.avatarUrl ?? undefined} alt={ownerName} />
              <AvatarFallback className="bg-raised text-[10px] text-foreground">{initial}</AvatarFallback>
            </Avatar>
            <span className="truncate">@{showroom.owner.username}</span>
            <VerifiedTick tier={showroom.owner.tier} className="size-3.5 shrink-0" />
          </Link>
          <Badge variant="outline" className="shrink-0 border-border text-[10px] text-secondary-text">
            {showroom.owner.displayName ?? "Creator"}
          </Badge>
        </div>
      </div>
    </article>
  );
}

/**
 * Creation editor. Picks real wallpapers/projects from the live APIs —
 * nothing is fabricated and no reference can be saved without validation.
 */
export function ShowroomEditor({
  open,
  onOpenChange,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: ShowroomView | null;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const { guard } = useVerificationGate();
  const [headline, setHeadline] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [selected, setSelected] = React.useState<SelectedShowroomItem[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setHeadline(existing?.headline ?? "");
    setDescription(existing?.description ?? "");
    setSelected(
      (existing?.items ?? []).map((item) => ({
        id: item.id,
        wallpaperSlug: item.type === "wallpaper" ? item.wallpaperSlug ?? undefined : undefined,
        projectId: item.type === "project" ? item.id : undefined,
        imageUrl: item.type === "image" ? item.imageUrl ?? undefined : undefined,
        caption: item.caption,
        image: item.imageUrl,
      })),
    );
  }, [open, existing]);

  const wallpapersQuery = useQuery<{ data: { items: PickerWallpaper[] } }>({
    queryKey: ["showroom-picker-wallpapers"],
    queryFn: () => fetch("/api/v1/wallpapers?sort=popular&limit=18").then((r) => {
      if (!r.ok) throw new Error("Failed to load wallpapers");
      return r.json();
    }),
    enabled: open,
  });

  const projectsQuery = useQuery<{ data: { items: PickerProject[] } }>({
    queryKey: ["showroom-picker-projects"],
    queryFn: () => fetch("/api/v1/projects/showcase?limit=18").then((r) => {
      if (!r.ok) throw new Error("Failed to load projects");
      return r.json();
    }),
    enabled: open,
  });

  const toggle = (item: SelectedShowroomItem) =>
    setSelected((current) =>
      current.some((entry) => entry.id === item.id)
        ? current.filter((entry) => entry.id !== item.id)
        : [...current, item],
    );

  const save = useMutation({
    mutationFn: async () => {
      const username = session?.user?.username;
      if (!username) throw new Error("Set a profile username first.");
      const res = await fetch("/api/v1/showroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: headline.trim() || "My WALLORA showroom",
          description: description.trim(),
          items: selected.map((item) => ({
            ...(item.wallpaperSlug ? { wallpaperSlug: item.wallpaperSlug } : {}),
            ...(item.projectId ? { projectId: item.projectId } : {}),
            ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
            caption: item.caption,
          })),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not save showroom.");
      return { username, body };
    },
    onSuccess: ({ username }) => {
      toast.success("Showroom saved", {
        description: `${selected.length} real ${selected.length === 1 ? "item" : "items"} in your gallery.`,
      });
      onOpenChange(false);
      void qc.invalidateQueries({ queryKey: ["showroom-list"] });
      router.push(`/showroom/${username}`);
      router.refresh();
    },
    onError: (err: Error) => toast.error("Could not save showroom", { description: err.message }),
  });

  const submit = () =>
    guard(() => save.mutate(), { action: "save your showroom" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-border bg-background">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {existing ? "Edit your showroom" : "Create your showroom"}
          </DialogTitle>
          <DialogDescription className="text-xs text-secondary-text">
            Pick real wallpapers and public projects. Every reference is validated before it is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="showroom-headline">Headline</Label>
            <Input
              id="showroom-headline"
              value={headline}
              onChange={(event) => setHeadline(event.target.value)}
              placeholder="A gallery of work I love"
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="showroom-description">Description</Label>
            <Textarea
              id="showroom-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Tell people what ties these pieces together."
              maxLength={1000}
              rows={2}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Selected work</Label>
              <span className="text-[11px] text-secondary-text">{selected.length} items</span>
            </div>
            {selected.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-secondary-text">
                Choose pieces from the real inventory below.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selected.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item)}
                    className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-foreground"
                  >
                    <Check className="size-3 text-primary" />
                    <span className="max-w-[160px] truncate">{item.caption}</span>
                    <X className="size-3 text-secondary-text" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <Tabs defaultValue="wallpapers">
            <TabsList className="bg-raised">
              <TabsTrigger value="wallpapers">Wallpapers</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
            </TabsList>
            <TabsContent value="wallpapers" className="mt-3">
              {wallpapersQuery.isLoading ? (
                <Loader2 className="mx-auto size-5 animate-spin text-secondary-text" />
              ) : (
                <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                  {(wallpapersQuery.data?.data.items ?? []).map((wallpaper) => {
                    const item: SelectedShowroomItem = {
                      id: `wp_${wallpaper.slug}`,
                      wallpaperSlug: wallpaper.slug,
                      caption: wallpaper.title,
                      image: wallpaper.asset?.objectKey ?? null,
                    };
                    const active = selected.some((entry) => entry.id === item.id);
                    return (
                      <button
                        key={wallpaper.slug}
                        type="button"
                        onClick={() => toggle(item)}
                        className={cn(
                          "relative aspect-video overflow-hidden rounded-lg border text-left transition-colors",
                          active ? "border-primary" : "border-border hover:border-primary/50",
                        )}
                      >
                        {item.image ? (
                          <img src={item.image} alt={wallpaper.title} className="size-full object-cover" loading="lazy" />
                        ) : (
                          <span className="flex size-full items-center justify-center bg-raised text-secondary-text">
                            <ImageIcon className="size-4" />
                          </span>
                        )}
                        <span className="absolute inset-x-0 bottom-0 truncate bg-background/85 px-2 py-1 text-[10px] text-foreground backdrop-blur">
                          {wallpaper.title}
                        </span>
                        {active && <Check className="absolute right-1.5 top-1.5 size-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </TabsContent>
            <TabsContent value="projects" className="mt-3">
              {projectsQuery.isLoading ? (
                <Loader2 className="mx-auto size-5 animate-spin text-secondary-text" />
              ) : (
                <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                  {(projectsQuery.data?.data.items ?? []).map((project) => {
                    const item: SelectedShowroomItem = {
                      id: `pr_${project.id}`,
                      projectId: project.id,
                      caption: project.name,
                      image: project.coverUrl,
                    };
                    const active = selected.some((entry) => entry.id === item.id);
                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => toggle(item)}
                        className={cn(
                          "relative aspect-video overflow-hidden rounded-lg border text-left transition-colors",
                          active ? "border-primary" : "border-border hover:border-primary/50",
                        )}
                      >
                        {item.image ? (
                          <img src={item.image} alt={project.name} className="size-full object-cover" loading="lazy" />
                        ) : (
                          <span className="flex size-full items-center justify-center bg-raised text-secondary-text">
                            <FolderOpen className="size-4" />
                          </span>
                        )}
                        <span className="absolute inset-x-0 bottom-0 truncate bg-background/85 px-2 py-1 text-[10px] text-foreground backdrop-blur">
                          {project.name}
                        </span>
                        {active && <Check className="absolute right-1.5 top-1.5 size-4 text-primary" />}
                      </button>
                    );
                  })}
                  {(projectsQuery.data?.data.items ?? []).length === 0 && !projectsQuery.isLoading && (
                    <p className="col-span-full flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-xs text-secondary-text">
                      <Sparkles className="size-3.5" /> No public projects are available yet.
                    </p>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={submit} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {existing ? "Save changes" : "Create showroom"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
