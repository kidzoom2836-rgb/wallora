"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Loader2, MessageSquare, LogIn, Send } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthDialog } from "@/stores/auth-dialog";
import { VerifiedTick } from "@/components/brand/verified-badge";
import { cn } from "@/lib/utils";

/**
 * CommentsSection
 *
 * Renders the comment thread for a single wallpaper. Public to read; writing
 * requires authentication (signed-out visitors see a "Sign in to comment"
 * prompt that opens the auth dialog).
 *
 * Data flow:
 *   - GET  /api/v1/wallpapers/[slug]/comments   (cached via TanStack Query)
 *   - POST /api/v1/wallpapers/[slug]/comments   (optimistic prepend on submit)
 */

export type CommentAuthor = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  verified: boolean;
};

export type CommentItem = {
  id: string;
  content: string;
  createdAt: string;
  author: CommentAuthor;
};

type CommentsResponse = {
  data: {
    items: CommentItem[];
    total: number;
    limit: number;
  };
};

type CommentsSectionProps = {
  slug: string;
  /** Optional className hook for layout fine-tuning by parent. */
  className?: string;
};

const MAX_LEN = 500;
const QUERY_KEY_BASE = "wallpaper-comments";

function initialsFrom(name: string | null): string {
  if (!name) return "W";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "W";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function CommentsSection({ slug, className }: CommentsSectionProps) {
  const { data: session } = useSession();
  const authenticated = !!session?.user;
  const openSignIn = useAuthDialog((s) => s.openSignIn);
  const queryClient = useQueryClient();

  const [draft, setDraft] = React.useState("");
  const queryKey = React.useMemo(() => [QUERY_KEY_BASE, slug] as const, [slug]);

  const { data, isLoading, isError } = useQuery<CommentsResponse>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/v1/wallpapers/${slug}/comments`);
      if (!res.ok) throw new Error("Failed to load comments");
      return res.json();
    },
    enabled: !!slug,
    staleTime: 15 * 1000,
  });

  const comments = data?.data.items ?? [];

  const submitMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/v1/wallpapers/${slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        const message = payload?.error?.message ?? "Could not post comment.";
        throw new Error(message);
      }
      return res.json() as Promise<{ data: CommentItem }>;
    },
    onMutate: async (content) => {
      // Optimistic update — prepend a local comment immediately.
      await queryClient.cancelQueries({ queryKey });
      const snapshot = queryClient.getQueryData<CommentsResponse>(queryKey);
      const optimistic: CommentItem = {
        id: `optimistic-${Date.now()}`,
        content,
        createdAt: new Date().toISOString(),
        author: {
          id: session?.user?.id ?? "me",
          username: session?.user?.username ?? null,
          displayName: session?.user?.name ?? null,
          avatarUrl: null,
          verified: false,
        },
      };
      queryClient.setQueryData<CommentsResponse>(queryKey, (prev) => ({
        data: {
          items: prev ? [optimistic, ...prev.data.items] : [optimistic],
          total: (prev?.data.total ?? 0) + 1,
          limit: prev?.data.limit ?? 50,
        },
      }));
      return { snapshot };
    },
    onError: (err: unknown, _content, ctx) => {
      // Roll back optimistic update.
      if (ctx?.snapshot) {
        queryClient.setQueryData(queryKey, ctx.snapshot);
      }
      const message = err instanceof Error ? err.message : "Could not post comment.";
      toast.error("Comment failed", { description: message });
    },
    onSuccess: (response) => {
      // Replace the optimistic entry with the real server comment.
      queryClient.setQueryData<CommentsResponse>(queryKey, (prev) => {
        if (!prev) return prev;
        const filtered = prev.data.items.filter(
          (c) => !c.id.startsWith("optimistic-"),
        );
        return {
          data: {
            items: [response.data, ...filtered],
            total: filtered.length + 1,
            limit: prev.data.limit,
          },
        };
      });
      setDraft("");
      toast.success("Comment posted");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    if (content.length > MAX_LEN) {
      toast.error("Comment too long", {
        description: `Comments are limited to ${MAX_LEN} characters.`,
      });
      return;
    }
    if (!authenticated) {
      openSignIn();
      return;
    }
    submitMutation.mutate(content);
  };

  const remaining = MAX_LEN - draft.length;

  return (
    <section
      className={cn("flex flex-col gap-4", className)}
      aria-label="Comments"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground">
          <MessageSquare className="h-4 w-4 text-primary" />
          Comments
          <span className="text-xs font-normal text-secondary-text">
            ({comments.length})
          </span>
        </h3>
      </div>

      {/* Composer */}
      {authenticated ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Share your thoughts on this wallpaper…"
            maxLength={MAX_LEN}
            rows={3}
            className="border-border bg-surface text-sm text-foreground placeholder:text-secondary-text focus-visible:border-primary/40"
            aria-label="Write a comment"
            disabled={submitMutation.isPending}
          />
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "text-[11px]",
                remaining < 0 ? "text-destructive" : "text-secondary-text",
              )}
            >
              {remaining} characters left
            </span>
            <Button
              type="submit"
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={submitMutation.isPending || draft.trim().length === 0}
            >
              {submitMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-3.5 w-3.5" />
              )}
              Post comment
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={openSignIn}
          className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-secondary-text transition-colors hover:border-primary/30 hover:text-foreground"
        >
          <LogIn className="h-4 w-4 text-primary" />
          Sign in to comment
        </button>
      )}

      {/* List */}
      <div className="flex flex-col gap-3">
        {isLoading ? (
          <CommentsSkeleton />
        ) : isError ? (
          <div className="rounded-lg border border-border bg-surface p-4 text-center text-sm text-secondary-text">
            Could not load comments. Please try again.
          </div>
        ) : comments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface/50 p-6 text-center">
            <p className="text-sm font-medium text-foreground">No comments yet</p>
            <p className="mt-1 text-xs text-secondary-text">
              Be the first to share what you think.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {comments.map((c) => (
              <CommentRow key={c.id} comment={c} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CommentRow({ comment }: { comment: CommentItem }) {
  const displayName = comment.author.displayName ?? comment.author.username ?? "WALLORA";
  const isOptimistic = comment.id.startsWith("optimistic-");

  return (
    <li className="flex gap-3 rounded-lg border border-border bg-surface p-3">
      {/* Avatar (initials fallback) */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
        aria-hidden
      >
        {initialsFrom(comment.author.displayName)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {displayName}
          </span>
          {comment.author.verified && (
            <VerifiedTick className="size-3.5" />
          )}
          {comment.author.username && (
            <span className="truncate text-xs text-secondary-text">
              @{comment.author.username}
            </span>
          )}
          <span className="ml-auto shrink-0 text-[11px] text-secondary-text">
            {isOptimistic
              ? "Posting…"
              : formatDistanceToNowStrict(new Date(comment.createdAt), {
                  addSuffix: true,
                })}
          </span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
          {comment.content}
        </p>
      </div>
    </li>
  );
}

function CommentsSkeleton() {
  return (
    <ul className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <li
          key={i}
          className="flex gap-3 rounded-lg border border-border bg-surface p-3"
        >
          <div className="h-9 w-9 shrink-0 animate-shimmer rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 animate-shimmer rounded" />
            <div className="h-3 w-full animate-shimmer rounded" />
            <div className="h-3 w-3/4 animate-shimmer rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}
