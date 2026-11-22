"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VerifiedTick } from "@/components/brand/verified-badge";
import { WalloraMonogram } from "@/components/brand/wallora-logo";
import { useVerificationGate } from "@/components/verification/verification-gate";
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CalendarIcon,
  CheckCircleIcon,
  FolderIcon,
  HeartIcon,
  ImageIcon,
  LoaderIcon,
  ShareIcon,
  SparklesIcon,
} from "@/components/icons/wallora-icons";

type PublicProject = {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
  assets: {
    id: string;
    assetType: "wallpaper" | "generation";
    note: string | null;
    wallpaper: { id: string; slug: string; title: string; orientation: string; gridAsset: { objectKey: string; width: number; height: number } | null } | null;
    generation: { id: string; prompt: string; publicUrl: string | null; aspectRatio: string } | null;
  }[];
  notes: { id: string; content: string; createdAt: string }[];
  meta: {
    status: string;
    progress: number;
    targetDate: string | null;
    milestones: { id: string; title: string; done: boolean; completedAt: string | null }[];
  };
  shoutouts: { userId: string; username: string | null; displayName: string | null; createdAt: string }[];
  owner: {
    username: string | null;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    tier: "free" | "verified" | "premium" | "supreme";
  };
};

const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  in_progress: "In progress",
  completed: "Completed",
  archived: "Archived",
};

function assetImage(a: PublicProject["assets"][number]): string | null {
  return a.assetType === "generation" ? a.generation?.publicUrl ?? null : a.wallpaper?.gridAsset?.objectKey ?? null;
}

export default function PublicProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const qc = useQueryClient();
  const { guard } = useVerificationGate();

  const { data, isLoading, isError } = useQuery<{ data: PublicProject }>({
    queryKey: ["public-project", id],
    queryFn: () => fetch(`/api/v1/projects/showcase/${id}`, { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error("not found");
      return r.json();
    }),
  });

  const shoutMutation = useMutation({
    mutationFn: () => fetch(`/api/v1/projects/${id}/shoutouts`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["public-project", id] });
      void qc.invalidateQueries({ queryKey: ["project-showcase"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoaderIcon size={26} className="animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <FolderIcon size={36} className="text-secondary-text" />
        <h1 className="font-display text-xl font-semibold">Project not found</h1>
        <p className="text-sm text-secondary-text">This showcase may have been made private or removed.</p>
        <Button asChild><Link href="/projects/showcase">Browse showcases</Link></Button>
      </div>
    );
  }

  const project = data.data;
  const hero = project.coverUrl ?? project.assets.map(assetImage).find(Boolean) ?? null;
  const completed = project.meta.milestones.filter((m) => m.done).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <WalloraMonogram className="size-7" />
            <span className="font-display text-sm font-bold tracking-wide">WALLORA</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild><Link href="/projects/showcase"><ArrowLeftIcon size={14} /> All projects</Link></Button>
            <Button variant="outline" size="sm" onClick={() => {
              void navigator.clipboard?.writeText(window.location.href);
              toast.success("Link copied");
            }}><ShareIcon size={14} /> Share</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        {/* Hero */}
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="relative h-48 sm:h-64">
            {hero ? <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-gradient-to-br from-primary/15 to-surface" />}
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/50 to-transparent" />
            <div className="absolute bottom-4 left-5 right-5 flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-background/80 text-background backdrop-blur" variant="secondary">{STATUS_LABEL[project.meta.status] ?? project.meta.status}</Badge>
                {project.meta.status === "completed" && <Badge className="border-success/30 bg-success/15 text-success"><CheckCircleIcon size={11} className="mr-1" />Completed</Badge>}
              </div>
              <Badge variant="outline" className="border-border bg-background/80 text-secondary-text backdrop-blur">
                {project.assets.length} assets · {project.notes.length} notes
              </Badge>
            </div>
          </div>
          <div className="px-5 pb-6 sm:px-7">
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">{project.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary-text">{project.description || "A creative project shared on WALLORA."}</p>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center overflow-hidden rounded-full border border-border bg-raised text-primary">
                  {project.owner.avatarUrl ? <img src={project.owner.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-sm font-semibold">{(project.owner.displayName ?? "W")[0].toUpperCase()}</span>}
                </span>
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    {project.owner.displayName ?? "@" + (project.owner.username ?? "creator")}
                    <VerifiedTick tier={project.owner.tier} className="size-4" />
                  </p>
                  <p className="text-xs text-secondary-text">@{project.owner.username ?? "creator"}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-primary/30"
                disabled={shoutMutation.isPending}
                onClick={() => guard(() => shoutMutation.mutate(), { action: "give a shoutout" })}
              >
                <HeartIcon size={15} className="text-primary" />
                {shoutMutation.isPending ? "Sending…" : `Shout out · ${project.shoutouts.length}`}
              </Button>
            </div>
          </div>
        </div>

        {/* Progress */}
        <section className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-secondary-text">
              <CheckCircleIcon size={16} className="text-primary" /> Journey
            </h2>
            <span className="text-sm font-semibold text-primary">{project.meta.progress ?? 0}% complete</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-primary" style={{ width: `${project.meta.progress ?? 0}%` }} />
          </div>
          {project.meta.targetDate && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-secondary-text"><CalendarIcon size={13} /> Target {new Date(project.meta.targetDate).toLocaleDateString()}</p>
          )}
          {project.meta.milestones.length > 0 && (
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {project.meta.milestones.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-raised/40 px-3 py-2">
                  <span className={m.done ? "text-success" : "text-secondary-text"}>
                    {m.done ? <CheckCircleIcon size={16} /> : <span className="block size-4 rounded-full border border-border" />}
                  </span>
                  <span className={m.done ? "text-sm text-secondary-text line-through" : "text-sm"}>{m.title}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-secondary-text">{completed} of {project.meta.milestones.length} milestones reached · Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}</p>
        </section>

        {/* Gallery */}
        <section className="mt-8">
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-secondary-text">The work</h2>
          {project.assets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-secondary-text">No assets shared in this project yet.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {project.assets.map((a) => {
                const img = assetImage(a);
                const title = a.assetType === "generation" ? a.generation?.prompt ?? "AI generation" : a.wallpaper?.title ?? "Wallpaper";
                return (
                  <figure key={a.id} className="group overflow-hidden rounded-xl border border-border bg-surface">
                    <div className="aspect-[4/3] overflow-hidden bg-raised">
                      {img ? <img src={img} alt={title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" /> : <div className="flex h-full items-center justify-center text-secondary-text"><ImageIcon size={22} /></div>}
                    </div>
                    <figcaption className="p-3">
                      <p className="truncate text-xs font-medium">{title}</p>
                      {a.note && <p className="mt-1 line-clamp-2 text-[11px] text-secondary-text">{a.note}</p>}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          )}
        </section>

        {/* Timeline / notes */}
        {project.notes.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-secondary-text">Notes &amp; timeline</h2>
            <div className="space-y-2">
              {project.notes.map((n) => (
                <div key={n.id} className="flex gap-3 rounded-xl border border-border bg-surface p-4">
                  <SparklesIcon size={16} className="mt-0.5 shrink-0 text-primary" />
                  <div>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{n.content}</p>
                    <p className="mt-1 text-[10px] text-secondary-text">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Shoutouts */}
        {project.shoutouts.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-secondary-text"><HeartIcon size={15} className="text-primary" /> Shoutouts</h2>
            <div className="flex flex-wrap gap-2">
              {project.shoutouts.slice(0, 12).map((s) => (
                <span key={s.userId} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-secondary-text">
                  {s.displayName ?? "@" + (s.username ?? "supporter")}
                </span>
              ))}
              {project.shoutouts.length > 12 && <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-secondary-text">+{project.shoutouts.length - 12} more</span>}
            </div>
          </section>
        )}

        <div className="mt-12 flex flex-col items-center gap-3 border-t border-border pt-8 text-center">
          <p className="text-sm text-secondary-text">Made with WALLORA</p>
          <Button size="sm" asChild className="bg-primary text-primary-foreground"><Link href="/register">Start your own project <ArrowUpRightIcon size={14} /></Link></Button>
        </div>
      </main>
    </div>
  );
}
