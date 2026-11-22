"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  Heart,
  Loader2,
  MessageCircle,
  Repeat2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { VerifiedTick } from "@/components/brand/verified-badge";
import { useVerificationGate } from "@/components/verification/verification-gate";
import { Button } from "@/components/ui/button";
import { useAuthDialog } from "@/stores/auth-dialog";
import { cn } from "@/lib/utils";

import { CommunityAvatar } from "./community-avatar";
import { CommunityComments } from "./community-comments";
import { CommunityShareMenu } from "./community-share-menu";
import { relativeTime, refHref, type CommunityPost } from "./types";

async function readResponse<T>(res: Response): Promise<T> {
  const payload = (await res.json().catch(() => null)) as
    | { data?: T; error?: { message?: string } }
    | null;
  if (!res.ok) throw new Error(payload?.error?.message ?? "Request failed.");
  if (!payload?.data) throw new Error("Unexpected response.");
  return payload.data;
}

export function CommunityPostCard({
  post,
  onOpen,
  onDeleted,
  defaultCommentsOpen = false,
  className,
}: {
  post: CommunityPost;
  onOpen: (id: string) => void;
  onDeleted?: (id: string) => void;
  defaultCommentsOpen?: boolean;
  className?: string;
}) {
  const { data: session, status } = useSession();
  const authenticated = status === "authenticated";
  const openSignIn = useAuthDialog((s) => s.openSignIn);
  const { guard } = useVerificationGate();
  const qc = useQueryClient();

  const [liked, setLiked] = React.useState(post.liked);
  const [likeCount, setLikeCount] = React.useState(post.likeCount);
  const [reposted, setReposted] = React.useState(post.reposted);
  const [repostCount, setRepostCount] = React.useState(post.repostCount);
  const [shareCount, setShareCount] = React.useState(post.shareCount);
  const [commentCount, setCommentCount] = React.useState(post.commentCount);
  const [commentsOpen, setCommentsOpen] = React.useState(defaultCommentsOpen);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => setLiked(post.liked), [post.liked]);
  React.useEffect(() => setLikeCount(post.likeCount), [post.likeCount]);
  React.useEffect(() => setReposted(post.reposted), [post.reposted]);
  React.useEffect(() => setRepostCount(post.repostCount), [post.repostCount]);
  React.useEffect(() => setShareCount(post.shareCount), [post.shareCount]);
  React.useEffect(() => setCommentCount(post.commentCount), [post.commentCount]);

  const likeMutation = useMutation({
    mutationFn: async (next: boolean) => {
      const res = await fetch(`/api/v1/community/posts/${post.id}/like`, {
        method: next ? "POST" : "DELETE",
      });
      return readResponse<{ liked: boolean; likeCount: number }>(res);
    },
    onMutate: (next) => {
      setLiked(next);
      setLikeCount((count) => Math.max(0, count + (next ? 1 : -1)));
    },
    onError: (error: unknown, next) => {
      setLiked(!next);
      setLikeCount((count) => Math.max(0, count + (next ? -1 : 1)));
      toast.error("Could not update like", {
        description: error instanceof Error ? error.message : undefined,
      });
    },
    onSuccess: (data) => {
      setLiked(data.liked);
      setLikeCount(data.likeCount);
      void qc.invalidateQueries({ queryKey: ["community-posts"] });
    },
  });

  const repostMutation = useMutation({
    mutationFn: async (next: boolean) => {
      const res = await fetch(`/api/v1/community/posts/${post.id}/repost`, {
        method: next ? "POST" : "DELETE",
      });
      return readResponse<{ reposted: boolean; repostCount: number }>(res);
    },
    onMutate: (next) => {
      setReposted(next);
      setRepostCount((count) => Math.max(0, count + (next ? 1 : -1)));
    },
    onError: (error: unknown, next) => {
      setReposted(!next);
      setRepostCount((count) => Math.max(0, count + (next ? -1 : 1)));
      toast.error("Could not update snap", {
        description: error instanceof Error ? error.message : undefined,
      });
    },
    onSuccess: (data) => {
      setReposted(data.reposted);
      setRepostCount(data.repostCount);
      void qc.invalidateQueries({ queryKey: ["community-posts"] });
    },
  });

  const requireAction = (action: string, run: () => void) => {
    if (!authenticated) {
      openSignIn();
      return;
    }
    guard(run, { action });
  };

  const href = refHref(post);
  const canDelete =
    authenticated &&
    (session?.user?.id === post.author.id || session?.user?.role === "super_admin");

  const handleDelete = async () => {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/community/posts/${post.id}`, {
        method: "DELETE",
      });
      await readResponse<{ id: string; deleted: boolean }>(res);
      toast.success("Post deleted");
      void qc.invalidateQueries({ queryKey: ["community-posts"] });
      onDeleted?.(post.id);
    } catch (error) {
      toast.error("Could not delete post", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-primary/25",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(post.id)}
        className="block w-full px-4 pt-4 text-left sm:px-5 sm:pt-5"
        aria-label={`Open post by ${post.author.displayName ?? post.author.username ?? "WALLORA"}`}
      >
        <div className="flex items-start gap-3">
          <CommunityAvatar author={post.author} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className="truncate text-sm font-semibold text-foreground">
                {post.author.displayName ?? post.author.username ?? "WALLORA"}
              </span>
              <VerifiedTick tier={post.author.tier} className="size-3.5" />
              {post.author.username && (
                <span className="truncate text-xs text-secondary-text">
                  @{post.author.username}
                </span>
              )}
              <span className="ml-auto shrink-0 text-[11px] text-secondary-text">
                {relativeTime(post.createdAt)}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground/95">
              {post.body}
            </p>
          </div>
        </div>

        {post.repostOf && (
          <div className="ml-[52px] mt-3 rounded-xl border border-border bg-raised/40 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs">
              <Repeat2 className="size-3.5 text-primary" />
              <span className="truncate font-medium text-foreground">
                {post.repostOf.author.displayName ?? post.repostOf.author.username ?? "WALLORA"}
              </span>
              <VerifiedTick tier={post.repostOf.author.tier} className="size-3" />
              <span className="text-secondary-text">· snapped</span>
            </div>
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-secondary-text">
              {post.repostOf.body}
            </p>
          </div>
        )}

        {post.imageUrl && (
          <div className="ml-[52px] mt-4 overflow-hidden rounded-xl border border-border bg-raised">
            <Image
              src={post.imageUrl}
              alt="Image shared with this post"
              width={1200}
              height={800}
              unoptimized
              className="max-h-[440px] w-full object-cover"
            />
          </div>
        )}

      </button>

      {href && (
        <div className="px-4 pb-1 sm:px-5">
          <Link
            href={href}
            className="ml-[52px] mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
          >
            <ExternalLink className="size-3" />
            {post.kind === "wallpaper" ? "View wallpaper" : "View project"}
          </Link>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-border px-2 py-2 sm:px-3">
        <ActionButton
          icon={Heart}
          label={liked ? "Liked" : "Like"}
          count={likeCount}
          active={liked}
          activeClass="text-destructive"
          busy={likeMutation.isPending}
          onClick={() => requireAction("like this post", () => likeMutation.mutate(!liked))}
        />
        <ActionButton
          icon={MessageCircle}
          label="Comment"
          count={commentCount}
          active={commentsOpen}
          activeClass="text-primary"
          onClick={() => setCommentsOpen((open) => !open)}
          expanded={commentsOpen}
        />
        <ActionButton
          icon={Repeat2}
          label={reposted ? "Snapped" : "Snap this"}
          count={repostCount}
          active={reposted}
          activeClass="text-primary"
          busy={repostMutation.isPending}
          onClick={() =>
            requireAction("snap this post", () => repostMutation.mutate(!reposted))
          }
        />
        <div className="flex items-center gap-1">
          <CommunityShareMenu
            post={post}
            onShared={(count) => setShareCount(count)}
          />
          {shareCount > 0 && (
            <span className="text-[11px] text-secondary-text">{shareCount}</span>
          )}
        </div>
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Delete post"
            disabled={deleting}
            onClick={() => void handleDelete()}
            className="ml-auto size-8 text-secondary-text hover:text-destructive"
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </Button>
        )}
      </div>

      {commentsOpen && (
        <div className="border-t border-border bg-background/30 px-4 py-4 sm:px-5">
          <CommunityComments
            postId={post.id}
            onCountChange={(delta) =>
              setCommentCount((count) => Math.max(0, count + delta))
            }
          />
        </div>
      )}
    </article>
  );
}

function ActionButton({
  icon: Icon,
  label,
  count,
  active,
  activeClass,
  busy,
  expanded,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  active?: boolean;
  activeClass?: string;
  busy?: boolean;
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active ?? expanded}
      aria-expanded={expanded}
      className={cn(
        "h-auto gap-1.5 px-2 py-1.5 text-xs text-secondary-text hover:bg-primary/10 hover:text-primary",
        active && activeClass,
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      <span>{label}</span>
      <span className="tabular-nums">{count}</span>
    </Button>
  );
}
