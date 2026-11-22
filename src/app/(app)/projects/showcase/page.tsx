"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { VerifiedTick } from "@/components/brand/verified-badge";
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CalendarIcon,
  CheckCircleIcon,
  FolderIcon,
  HeartIcon,
  ImageIcon,
  LoaderIcon,
  SearchIcon,
  SparklesIcon,
} from "@/components/icons/wallora-icons";
import { cn } from "@/lib/utils";

type ShowcaseItem = {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  updatedAt: string;
  assetCount: number;
  noteCount: number;
  shoutoutCount: number;
  meta: { status: string; progress: number; targetDate: string | null };
  owner: { username: string | null; displayName: string | null; tier: "free" | "verified" | "premium" };
};

const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  in_progress: "In progress",
  completed: "Completed",
  archived: "Archived",
};

export default function ShowcaseExplorePage() {
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const { data, isLoading, isError, refetch } = useQuery<{
    data: { items: ShowcaseItem[]; pagination: { total: number } };
  }>({
    queryKey: ["project-showcase", debounced],
    queryFn: () =>
      fetch(`/api/v1/projects/showcase?q=${encodeURIComponent(debounced)}&limit=36`)
        .then((r) => {
          if (!r.ok) throw new Error("Failed to load showcases");
          return r.json();
        }),
  });

  const items = data?.data.items ?? [];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2 text-secondary-text hover:text-foreground">
              <Link href="/projects"><ArrowLeftIcon size={14} /> My projects</Link>
            </Button>
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Community showcases</h1>
            <p className="mt-2 max-w-2xl text-sm text-secondary-text">
              Real projects from WALLORA creators — collections, moodboards and ideas with progress you can follow.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3">
            <SearchIcon size={15} className="text-secondary-text" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects"
              className="w-44 bg-transparent py-2 text-sm outline-none sm:w-56"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="mt-12 flex justify-center"><LoaderIcon size={26} className="animate-spin text-primary" /></div>
        ) : isError ? (
          <div className="mt-12 text-center">
            <p className="text-sm text-secondary-text">Couldn&apos;t load showcases.</p>
            <Button size="sm" className="mt-3" onClick={() => void refetch()}>Try again</Button>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface/40 py-16 text-center">
            <FolderIcon size={32} className="text-secondary-text" />
            <p className="text-sm text-secondary-text">No public showcases yet. Be the first to publish one.</p>
            <Button size="sm" asChild className="bg-primary text-primary-foreground"><Link href="/projects">Create a project</Link></Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/projects/${item.id}`}
                className="group overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-primary/40"
              >
                <div className="relative h-44 overflow-hidden bg-raised">
                  {item.coverUrl ? (
                    <img src={item.coverUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 to-surface text-primary"><SparklesIcon size={28} /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-surface/60 to-transparent" />
                  <div className="absolute left-3 top-3 flex gap-2">
                    <Badge variant="outline" className="border-border bg-background/80 text-[10px] backdrop-blur">{STATUS_LABEL[item.meta.status] ?? item.meta.status}</Badge>
                    {item.meta.status === "completed" && <Badge className="border-success/30 bg-success/15 text-[10px] text-success"><CheckCircleIcon size={11} className="mr-1" />Done</Badge>}
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="truncate font-display text-sm font-semibold text-foreground">{item.name}</h2>
                    <ArrowUpRightIcon size={15} className="shrink-0 text-secondary-text transition-colors group-hover:text-primary" />
                  </div>
                  <p className="mt-1 line-clamp-2 min-h-[2rem] text-xs text-secondary-text">{item.description || "A creative project on WALLORA."}</p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-secondary-text">
                    <span className="flex items-center gap-1 truncate">
                      @{item.owner.username ?? "creator"}
                      <VerifiedTick tier={item.owner.tier} className="size-3" />
                    </span>
                    <span aria-hidden>·</span>
                    <span>{formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-secondary-text">
                    <span className="flex items-center gap-1"><ImageIcon size={12} /> {item.assetCount}</span>
                    <span className="flex items-center gap-1"><HeartIcon size={12} /> {item.shoutoutCount}</span>
                    {item.meta.targetDate && <span className="flex items-center gap-1"><CalendarIcon size={12} /> {new Date(item.meta.targetDate).toLocaleDateString()}</span>}
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
                    <div className={cn("h-full rounded-full bg-primary")} style={{ width: `${item.meta.progress ?? 0}%` }} />
                  </div>
                  <p className="mt-1 text-right text-[10px] text-secondary-text">{item.meta.progress ?? 0}% complete</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
