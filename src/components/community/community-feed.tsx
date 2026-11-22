"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  LogIn,
  RefreshCw,
  Search,
  SearchX,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthDialog } from "@/stores/auth-dialog";
import { cn } from "@/lib/utils";

import { CommunityComposer } from "./community-composer";
import { CommunityPostCard } from "./community-post-card";
import { CommunityPostDetail } from "./community-post-detail";
import { CommunityFeedSkeleton } from "./community-skeletons";
import type { FeedResponse, FeedSort } from "./types";

const PAGE_SIZE = 12;

export function CommunityFeed() {
  const { status } = useSession();
  const authenticated = status === "authenticated";
  const openSignIn = useAuthDialog((s) => s.openSignIn);

  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [sort, setSort] = React.useState<FeedSort>("recent");
  const [page, setPage] = React.useState(1);
  const [postId, setPostId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  React.useEffect(() => setPage(1), [debounced, sort]);

  React.useEffect(() => {
    const sync = () => {
      setPostId(new URLSearchParams(window.location.search).get("post"));
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const { data, isLoading, isError, isFetching, refetch } = useQuery<FeedResponse>({
    queryKey: ["community-posts", debounced, sort, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        q: debounced,
        sort,
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/v1/community/posts?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load the community feed.");
      return res.json() as Promise<FeedResponse>;
    },
  });

  const items = data?.data.items ?? [];
  const pagination = data?.data.pagination;

  const openPost = (id: string) => {
    setPostId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("post", id);
    window.history.pushState({}, "", url);
  };

  const closePost = () => {
    setPostId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("post");
    window.history.replaceState({}, "", url);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary">
              <Sparkles className="size-3" />
              WALLORA community
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              The community feed
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-secondary-text">
              Real posts from real creators. Share what you&apos;re making, snap the work you
              love and keep the conversation going.
            </p>
          </div>
          {pagination && (
            <span className="text-xs text-secondary-text">
              {pagination.total} {pagination.total === 1 ? "post" : "posts"}
            </span>
          )}
        </header>

        {status === "unauthenticated" && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-sm text-secondary-text">
              You can read everything. Sign in to post, snap and reply.
            </p>
            <Button size="sm" onClick={openSignIn} className="bg-primary text-primary-foreground">
              <LogIn className="size-4" />
              Sign in
            </Button>
          </div>
        )}

        <div className="mt-6">
          <CommunityComposer />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-primary/50">
            <Search className="size-4 shrink-0 text-secondary-text" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search posts, creators…"
              aria-label="Search community posts"
              className="h-10 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center rounded-xl border border-border bg-surface p-1">
            <SortButton
              active={sort === "recent"}
              icon={Clock3}
              label="Recent"
              onClick={() => setSort("recent")}
            />
            <SortButton
              active={sort === "popular"}
              icon={TrendingUp}
              label="Popular"
              onClick={() => setSort("popular")}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Refresh feed"
            title="Refresh feed"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="size-10 border border-border bg-surface text-secondary-text hover:text-primary"
          >
            <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
          </Button>
        </div>

        <div className="mt-5 space-y-4">
          {isLoading ? (
            <CommunityFeedSkeleton />
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-16 text-center">
              <AlertCircle className="size-8 text-destructive" />
              <p className="text-sm font-medium text-foreground">Couldn&apos;t load the feed</p>
              <p className="max-w-sm text-xs text-secondary-text">
                Something went wrong while fetching community posts. Please try again.
              </p>
              <Button size="sm" onClick={() => void refetch()}>
                <RefreshCw className="size-4" />
                Try again
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface/40 px-4 py-16 text-center">
              {debounced ? (
                <SearchX className="size-8 text-secondary-text" />
              ) : (
                <Compass className="size-8 text-secondary-text" />
              )}
              <p className="text-sm font-medium text-foreground">
                {debounced ? "No posts match your search" : "No posts yet"}
              </p>
              <p className="max-w-sm text-xs text-secondary-text">
                {debounced
                  ? "Try a different word or switch back to recent posts."
                  : "Be the first to share something with the community."}
              </p>
              {debounced && (
                <Button size="sm" variant="outline" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            items.map((post) => (
              <CommunityPostCard key={post.id} post={post} onOpen={openPost} />
            ))
          )}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <span className="text-xs tabular-nums text-secondary-text">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages || isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>

      <CommunityPostDetail postId={postId} onClose={closePost} />
    </div>
  );
}

function SortButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-primary/15 text-primary"
          : "text-secondary-text hover:bg-raised hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
