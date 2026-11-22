"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { CommunityPostCard } from "./community-post-card";
import type { PostDetailResponse } from "./types";

export function CommunityPostDetail({
  postId,
  onClose,
}: {
  postId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError, refetch } = useQuery<PostDetailResponse>({
    queryKey: ["community-post", postId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/community/posts/${postId}`);
      if (!res.ok) throw new Error("This post is no longer available.");
      return res.json() as Promise<PostDetailResponse>;
    },
    enabled: !!postId,
    staleTime: 15 * 1000,
  });

  return (
    <Dialog open={!!postId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto border-border bg-surface p-0">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12">
          <DialogTitle className="font-display text-lg">Community post</DialogTitle>
          <DialogDescription className="text-xs text-secondary-text">
            The full post and its conversation.
          </DialogDescription>
        </DialogHeader>
        <div className="p-4 sm:p-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-secondary-text">
              <Loader2 className="size-4 animate-spin text-primary" />
              Loading post…
            </div>
          ) : isError || !data?.data ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <AlertCircle className="size-7 text-destructive" />
              <p className="text-sm text-secondary-text">
                This post is no longer available.
              </p>
              <Button size="sm" variant="outline" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <CommunityPostCard
              post={data.data}
              defaultCommentsOpen
              onOpen={() => {}}
              onDeleted={onClose}
              className="border-border/70 bg-background/30"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
