"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, LogIn, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

import { VerifiedTick } from "@/components/brand/verified-badge";
import { useVerificationGate } from "@/components/verification/verification-gate";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthDialog } from "@/stores/auth-dialog";
import { cn } from "@/lib/utils";

import { CommunityAvatar } from "./community-avatar";
import { relativeTime, type CommentsResponse, type CommunityComment } from "./types";

const MAX_LEN = 500;

export function CommunityComments({
  postId,
  onCountChange,
  className,
}: {
  postId: string;
  onCountChange?: (delta: number) => void;
  className?: string;
}) {
  const { data: session, status } = useSession();
  const authenticated = status === "authenticated";
  const openSignIn = useAuthDialog((s) => s.openSignIn);
  const { guard, tier } = useVerificationGate();
  const qc = useQueryClient();
  const queryKey = React.useMemo(() => ["community-comments", postId] as const, [postId]);
  const [draft, setDraft] = React.useState("");

  const { data, isLoading, isError, refetch } = useQuery<CommentsResponse>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/v1/community/posts/${postId}/comments`);
      if (!res.ok) throw new Error("Failed to load comments");
      return res.json() as Promise<CommentsResponse>;
    },
    enabled: !!postId,
    staleTime: 15 * 1000,
  });

  const optimisticAuthor = React.useMemo(
    () => ({
      id: session?.user?.id ?? "me",
      username: session?.user?.username ?? null,
      displayName: session?.user?.name ?? null,
      avatarUrl: session?.user?.image ?? null,
      tier,
    }),
    [session?.user?.id, session?.user?.username, session?.user?.name, session?.user?.image, tier],
  );

  const mutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/v1/community/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(payload?.error?.message ?? "Could not post comment.");
      }
      return res.json() as Promise<{ data: CommunityComment }>;
    },
    onMutate: async (content) => {
      await qc.cancelQueries({ queryKey });
      const snapshot = qc.getQueryData<CommentsResponse>(queryKey);
      const optimistic: CommunityComment = {
        id: `optimistic-${Date.now()}`,
        postId,
        content,
        createdAt: new Date().toISOString(),
        author: optimisticAuthor,
      };
      qc.setQueryData<CommentsResponse>(queryKey, (prev) => ({
        data: {
          items: prev ? [optimistic, ...prev.data.items] : [optimistic],
          total: (prev?.data.total ?? 0) + 1,
          limit: prev?.data.limit ?? 50,
        },
      }));
      onCountChange?.(1);
      return { snapshot };
    },
    onError: (error: unknown, _content, context) => {
      if (context?.snapshot) qc.setQueryData(queryKey, context.snapshot);
      onCountChange?.(-1);
      toast.error("Comment failed", {
        description: error instanceof Error ? error.message : "Could not post comment.",
      });
    },
    onSuccess: (response) => {
      qc.setQueryData<CommentsResponse>(queryKey, (prev) => {
        const rest = (prev?.data.items ?? []).filter(
          (comment) => !comment.id.startsWith("optimistic-"),
        );
        return {
          data: {
            items: [response.data, ...rest],
            total: rest.length + 1,
            limit: prev?.data.limit ?? 50,
          },
        };
      });
      setDraft("");
      toast.success("Comment posted");
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    if (content.length > MAX_LEN) {
      toast.error(`Comments are limited to ${MAX_LEN} characters.`);
      return;
    }
    if (!authenticated) {
      openSignIn();
      return;
    }
    guard(() => mutation.mutate(content), { action: "join the conversation" });
  };

  const comments = data?.data.items ?? [];

  return (
    <section className={cn("space-y-4", className)} aria-label="Comments">
      {authenticated ? (
        <form onSubmit={submit} className="space-y-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add to the conversation…"
            aria-label="Write a comment"
            maxLength={MAX_LEN}
            rows={2}
            disabled={mutation.isPending}
            className="border-border bg-raised/40 text-sm text-foreground placeholder:text-secondary-text focus-visible:border-primary/50"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-secondary-text">
              {MAX_LEN - draft.length} characters left
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={mutation.isPending || draft.trim().length === 0}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {mutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Reply
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={openSignIn}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-raised/40 px-4 py-3 text-sm text-secondary-text transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <LogIn className="size-4 text-primary" />
          Sign in to comment
        </button>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3 rounded-xl border border-border bg-raised/30 p-3">
              <div className="size-8 shrink-0 animate-pulse rounded-full bg-accent" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-28 animate-pulse rounded bg-accent" />
                <div className="h-3 w-full animate-pulse rounded bg-accent" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-secondary-text">
          <span className="flex items-center gap-2">
            <AlertCircle className="size-4 text-destructive" />
            Couldn&apos;t load comments.
          </span>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-raised/20 px-4 py-8 text-center">
          <MessageSquare className="mx-auto size-5 text-secondary-text" />
          <p className="mt-2 text-sm font-medium text-foreground">No replies yet</p>
          <p className="mt-1 text-xs text-secondary-text">Start the conversation.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <CommunityCommentRow key={comment.id} comment={comment} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CommunityCommentRow({ comment }: { comment: CommunityComment }) {
  const pending = comment.id.startsWith("optimistic-");
  const name = comment.author.displayName ?? comment.author.username ?? "WALLORA";
  return (
    <li className="flex gap-3 rounded-xl border border-border bg-raised/30 p-3">
      <CommunityAvatar author={comment.author} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">{name}</span>
          <VerifiedTick tier={comment.author.tier} className="size-3" />
          {comment.author.username && (
            <span className="truncate text-xs text-secondary-text">@{comment.author.username}</span>
          )}
          <span className="ml-auto shrink-0 text-[11px] text-secondary-text">
            {pending ? "Posting…" : relativeTime(comment.createdAt)}
          </span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
          {comment.content}
        </p>
      </div>
    </li>
  );
}
