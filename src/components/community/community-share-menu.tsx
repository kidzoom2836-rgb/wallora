"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import {
  Camera,
  Facebook,
  Instagram,
  Link2,
  MessageCircle,
  Music2,
  Share,
  Share2,
  Twitter,
} from "lucide-react";
import { toast } from "sonner";

import { useVerificationGate } from "@/components/verification/verification-gate";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuthDialog } from "@/stores/auth-dialog";
import { cn } from "@/lib/utils";

import { localShareUrl, type CommunityPost, type SharePlatform } from "./types";

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy copy path (insecure contexts / permissions).
  }
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  } catch {
    return false;
  }
}

export function CommunityShareMenu({
  post,
  onShared,
  className,
}: {
  post: Pick<CommunityPost, "id" | "body">;
  onShared?: (shareCount: number) => void;
  className?: string;
}) {
  const { status } = useSession();
  const authenticated = status === "authenticated";
  const openSignIn = useAuthDialog((s) => s.openSignIn);
  const { guard } = useVerificationGate();
  const [open, setOpen] = React.useState(false);
  const [canDeviceShare, setCanDeviceShare] = React.useState(false);

  React.useEffect(() => {
    setCanDeviceShare(
      typeof window !== "undefined" &&
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function",
    );
  }, []);

  const recordShare = React.useCallback(
    async (platform: SharePlatform): Promise<string> => {
      const fallback = localShareUrl(post.id);
      try {
        const res = await fetch(`/api/v1/community/posts/${post.id}/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform }),
        });
        if (!res.ok) return fallback;
        const payload = (await res.json()) as {
          data?: { shareCount?: number; shareUrl?: string };
        };
        if (typeof payload.data?.shareCount === "number") {
          onShared?.(payload.data.shareCount);
        }
        return payload.data?.shareUrl ?? fallback;
      } catch {
        return fallback;
      }
    },
    [post.id, onShared],
  );

  const openIntent = (platform: SharePlatform, buildUrl: (url: string) => string) => {
    // Fire the counter without awaiting so the popup is not blocked.
    void recordShare(platform);
    window.open(buildUrl(localShareUrl(post.id)), "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const copyFor = async (platform: SharePlatform, label: string | null) => {
    const url = await recordShare(platform);
    const copied = await copyText(url);
    if (copied) {
      toast.success(label ? `Link copied — paste it into ${label}` : "Link copied");
    } else {
      window.prompt("Copy this link", url);
    }
    setOpen(false);
  };

  const deviceShare = async () => {
    const url = await recordShare("copy");
    try {
      await navigator.share({
        title: "WALLORA community post",
        text: post.body.slice(0, 180),
        url,
      });
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        toast.error("Device sharing failed", { description: error.message });
      }
    }
    setOpen(false);
  };

  /** Sharing counts as a write on the server, so it goes through the same gate. */
  const protect = (run: () => void) => {
    if (!authenticated) {
      setOpen(false);
      openSignIn();
      return;
    }
    guard(run, { action: "share this post" });
  };

  const text = `${post.body.slice(0, 300)}\n\n`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Share post"
          aria-expanded={open}
          className={cn(
            "h-auto gap-1.5 px-2 py-1.5 text-xs text-secondary-text hover:bg-primary/10 hover:text-primary",
            open && "bg-primary/10 text-primary",
            className,
          )}
        >
          <Share2 className="size-4" />
          <span>Share</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 border-border bg-surface p-2 shadow-xl">
        <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-secondary-text">
          Share this post
        </p>
        <div className="space-y-0.5">
          {canDeviceShare && (
            <ShareOption
              icon={Share}
              label="Share via device"
              onClick={() => protect(() => void deviceShare())}
            />
          )}
          <ShareOption
            icon={MessageCircle}
            label="WhatsApp"
            onClick={() =>
              protect(() =>
                openIntent(
                  "whatsapp",
                  (url) => `https://wa.me/?text=${encodeURIComponent(`${text}${url}`)}`,
                ),
              )
            }
          />
          <ShareOption
            icon={Facebook}
            label="Facebook"
            onClick={() =>
              protect(() =>
                openIntent(
                  "facebook",
                  (url) =>
                    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
                ),
              )
            }
          />
          <ShareOption
            icon={Twitter}
            label="X / Twitter"
            onClick={() =>
              protect(() =>
                openIntent(
                  "copy",
                  (url) =>
                    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
                ),
              )
            }
          />
          <ShareOption
            icon={Instagram}
            label="Instagram"
            onClick={() => protect(() => void copyFor("instagram", "Instagram"))}
          />
          <ShareOption
            icon={Music2}
            label="TikTok"
            onClick={() => protect(() => void copyFor("tiktok", "TikTok"))}
          />
          <ShareOption
            icon={Camera}
            label="Snapchat"
            onClick={() => protect(() => void copyFor("snapchat", "Snapchat"))}
          />
          <div className="my-1 border-t border-border" />
          <ShareOption
            icon={Link2}
            label="Copy link"
            onClick={() => protect(() => void copyFor("copy", null))}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ShareOption({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-foreground/90 transition-colors hover:bg-primary/10 hover:text-primary"
    >
      <Icon className="size-4 shrink-0 text-secondary-text" />
      {label}
    </button>
  );
}
