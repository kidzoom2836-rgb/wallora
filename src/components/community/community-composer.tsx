"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogIn, PenLine, Send } from "lucide-react";
import { toast } from "sonner";

import { useVerificationGate } from "@/components/verification/verification-gate";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthDialog } from "@/stores/auth-dialog";
import { cn } from "@/lib/utils";

import { CommunityAvatar } from "./community-avatar";
import type { CommunityPost, FeedResponse } from "./types";

const MAX_LEN = 2000;
const FEED_KEY = ["community-posts"] as const;

export function CommunityComposer() {
  const { data: session, status } = useSession();
  const authenticated = status === "authenticated";
  const openSignIn = useAuthDialog((s) => s.openSignIn);
  const { guard, tier } = useVerificationGate();
  const qc = useQueryClient();
  const [text, setText] = React.useState("");

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
    mutationFn: async (body: string) => {
      const res = await fetch("/api/v1/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { data?: CommunityPost; error?: { message?: string } }
        | null;
      if (!res.ok || !payload?.data) {
        throw new Error(payload?.error?.message ?? "Could not publish your post.");
      }
      return payload.data;
    },
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: FEED_KEY });
      const snapshot = qc.getQueriesData<FeedResponse>({ queryKey: FEED_KEY });
      const optimistic: CommunityPost = {
        id: `optimistic-composer-${Date.now()}`,
        author: optimisticAuthor,
        body,
        kind: "text",
        refId: null,
        imageUrl: null,
        repostOf: null,
        likeCount: 0,
        commentCount: 0,
        repostCount: 0,
        shareCount: 0,
        liked: false,
        reposted: false,
        createdAt: new Date().toISOString(),
      };
      qc.setQueriesData<FeedResponse>({ queryKey: FEED_KEY }, (prev) =>
        prev
          ? {
              ...prev,
              data: {
                items: [optimistic, ...prev.data.items],
                pagination: {
                  ...prev.data.pagination,
                  total: prev.data.pagination.total + 1,
                },
              },
            }
          : prev,
      );
      return { snapshot };
    },
    onError: (error: unknown, _body, context) => {
      context?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error("Post failed", {
        description: error instanceof Error ? error.message : "Could not publish your post.",
      });
    },
    onSuccess: (post) => {
      qc.setQueriesData<FeedResponse>({ queryKey: FEED_KEY }, (prev) =>
        prev
          ? {
              ...prev,
              data: {
                items: [
                  post,
                  ...prev.data.items.filter(
                    (item) => !item.id.startsWith("optimistic-composer-"),
                  ),
                ],
                pagination: prev.data.pagination,
              },
            }
          : prev,
      );
      setText("");
      toast.success("Posted to the community");
      void qc.invalidateQueries({ queryKey: FEED_KEY });
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    if (body.length > MAX_LEN) {
      toast.error(`Posts are limited to ${MAX_LEN} characters.`);
      return;
    }
    if (!authenticated) {
      openSignIn();
      return;
    }
    guard(() => mutation.mutate(body), { action: "share with the community" });
  };

  const remaining = MAX_LEN - text.length;

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      {authenticated ? (
        <form onSubmit={submit}>
          <div className="flex gap-3">
            <CommunityAvatar author={optimisticAuthor} className="hidden sm:inline-flex" />
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="What are you creating, WALLORA?"
              aria-label="Write a community post"
              maxLength={MAX_LEN}
              rows={3}
              disabled={mutation.isPending}
              className="min-h-24 flex-1 resize-none border-border bg-raised/40 text-[15px] leading-relaxed text-foreground placeholder:text-secondary-text focus-visible:border-primary/50"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <span
              className={cn(
                "text-[11px] tabular-nums",
                remaining <= 100 ? "text-destructive" : "text-secondary-text",
              )}
            >
              {remaining} characters left
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={mutation.isPending || text.trim().length === 0}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Post
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={openSignIn}
          className="flex w-full items-center gap-3 rounded-xl text-left"
        >
          <CommunityAvatar
            author={{
              id: "system",
              username: "wallora",
              displayName: "WALLORA",
              avatarUrl: null,
              tier: "verified",
            }}
            className="hidden sm:inline-flex"
          />
          <span className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-raised/40 px-4 py-3 text-sm text-secondary-text transition-colors group-hover:border-primary/40">
            <PenLine className="size-4 text-primary" />
            Share something with the community…
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <LogIn className="size-4" />
            Sign in
          </span>
        </button>
      )}
    </section>
  );
}
