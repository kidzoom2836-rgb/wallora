"use client";

import * as React from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, LogIn, PenLine, Send, X } from "lucide-react";
import { toast } from "sonner";

import { useVerificationGate } from "@/components/verification/verification-gate";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthDialog } from "@/stores/auth-dialog";
import { cn } from "@/lib/utils";
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/lib/upload-config";

import { CommunityAvatar } from "./community-avatar";
import type { CommunityPost, FeedResponse } from "./types";

const MAX_LEN = 2000;
const FEED_KEY = ["community-posts"] as const;

type ComposerValue = { body: string; file: File | null; preview: string | null };

export function CommunityComposer() {
  const { data: session, status } = useSession();
  const authenticated = status === "authenticated";
  const openSignIn = useAuthDialog((s) => s.openSignIn);
  const { guard, tier } = useVerificationGate();
  const qc = useQueryClient();
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

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
    mutationFn: async ({ body, file: image }: ComposerValue) => {
      let imageKey: string | null = null;

      if (image) {
        const presignRes = await fetch("/api/v1/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: image.name,
            contentType: image.type,
            size: image.size,
          }),
        });
        const presignPayload = await presignRes.json().catch(() => null);
        if (!presignRes.ok) {
          throw new Error(presignPayload?.error?.message ?? "Could not prepare the image upload.");
        }

        const uploads = presignPayload?.data?.uploads?.length
          ? presignPayload.data.uploads
          : [presignPayload.data];
        const upload = uploads[0];
        if (!upload?.key || !upload?.uploadUrl) {
          throw new Error("The upload service returned an invalid response.");
        }

        const form = new FormData();
        Object.entries(upload.fields ?? {}).forEach(([key, value]) => form.append(key, String(value)));
        form.append("file", image);

        const uploadRes = await fetch(upload.uploadUrl, {
          method: "POST",
          headers: upload.headers ?? {},
          body: form,
        });
        if (!uploadRes.ok) {
          throw new Error("Could not upload the image. Please try again.");
        }
        imageKey = upload.key;
      }

      const res = await fetch("/api/v1/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          ...(imageKey
            ? { kind: "image", imageKey }
            : {}),
        }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { data?: CommunityPost; error?: { message?: string } }
        | null;
      if (!res.ok || !payload?.data) {
        throw new Error(payload?.error?.message ?? "Could not publish your post.");
      }
      return payload.data;
    },
    onMutate: async ({ body, preview: optimisticPreview }) => {
      await qc.cancelQueries({ queryKey: FEED_KEY });
      const snapshot = qc.getQueriesData<FeedResponse>({ queryKey: FEED_KEY });
      const optimistic: CommunityPost = {
        id: `optimistic-composer-${Date.now()}`,
        author: optimisticAuthor,
        body,
        kind: optimisticPreview ? "image" : "text",
        refId: null,
        imageUrl: optimisticPreview,
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
    onError: (error: unknown, _value, context) => {
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
      setFile(null);
      setPreview(null);
      if (fileInput.current) fileInput.current.value = "";
      toast.success("Posted to the community");
      void qc.invalidateQueries({ queryKey: FEED_KEY });
    },
  });

  const selectImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) return;
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(selected.type)) {
      toast.error("Choose a JPG, PNG or WebP image.");
      event.target.value = "";
      return;
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      toast.error(`Images must be smaller than ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB.`);
      event.target.value = "";
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const removeImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const body = text.trim();
    if (!body && !file) return;
    if (body.length > MAX_LEN) {
      toast.error(`Posts are limited to ${MAX_LEN} characters.`);
      return;
    }
    if (!authenticated) {
      openSignIn();
      return;
    }
    guard(() => mutation.mutate({ body, file, preview }), { action: "share with the community" });
  };

  const remaining = MAX_LEN - text.length;
  const canPost = mutation.isPending || (!text.trim() && !file);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      {authenticated ? (
        <form onSubmit={submit}>
          <div className="flex gap-3">
            <CommunityAvatar author={optimisticAuthor} className="hidden sm:inline-flex" />
            <div className="min-w-0 flex-1">
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="What are you creating, WALLORA?"
                aria-label="Write a community post"
                maxLength={MAX_LEN}
                rows={3}
                disabled={mutation.isPending}
                className="min-h-24 w-full resize-none border-border bg-raised/40 text-[15px] leading-relaxed text-foreground placeholder:text-secondary-text focus-visible:border-primary/50"
              />

              {preview && (
                <div className="mt-3 overflow-hidden rounded-xl border border-border bg-raised">
                  <div className="relative">
                    <Image
                      src={preview}
                      alt="Image selected for your community post"
                      width={480}
                      height={260}
                      unoptimized
                      className="max-h-60 w-full object-cover"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      aria-label="Remove image"
                      onClick={removeImage}
                      className="absolute right-2 top-2 size-8 rounded-full"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept={ALLOWED_MIME_TYPES.join(",")}
            onChange={selectImage}
            className="hidden"
            aria-label="Attach an image to your post"
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={mutation.isPending}
                onClick={() => fileInput.current?.click()}
                className="text-primary"
              >
                <ImagePlus className="size-4" />
                {file ? "Change image" : "Add image"}
              </Button>
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  remaining <= 100 ? "text-destructive" : "text-secondary-text",
                )}
              >
                {remaining} characters left
              </span>
            </div>
            <Button type="submit" size="sm" disabled={canPost}>
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
