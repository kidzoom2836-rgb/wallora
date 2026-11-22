"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";

import {
  UploadIcon,
  CheckCircleIcon,
  AlertIcon,
  ImageIcon,
  EyeIcon,
  HeartIcon,
  DownloadIcon,
} from "@/components/icons/wallora-icons";
import { Button } from "@/components/ui/button";
import { useDiscovery } from "@/stores/discovery";
import { cn } from "@/lib/utils";

type MyWallpaper = {
  id: string;
  slug: string;
  title: string;
  status: string;
  orientation: string;
  dominantColor: string | null;
  likeCount: number;
  favoriteCount: number;
  downloadCount: number;
  viewCount: number;
  createdAt: string;
  category: { slug: string; name: string } | null;
  gridAsset: { objectKey: string; width: number; height: number } | null;
  assets: { variant: string; objectKey: string; width: number; height: number; fileSize: number; format: string }[];
  variationCount?: number;
  variations?: {
    index: number;
    label: string;
    preview: { variant: string; objectKey: string; width: number; height: number } | null;
  }[];
};

type Response = {
  data: {
    items: MyWallpaper[];
    pagination: { total: number };
  };
};

const STATUS_CONFIG: Record<string, { icon: typeof UploadIcon; color: string; label: string }> = {
  pending: { icon: UploadIcon, color: "border-primary/30 bg-primary/10 text-primary", label: "Pending review" },
  approved: { icon: CheckCircleIcon, color: "border-success/30 bg-success/10 text-success", label: "Approved" },
  rejected: { icon: AlertIcon, color: "border-destructive/30 bg-destructive/10 text-destructive", label: "Rejected" },
  flagged: { icon: AlertIcon, color: "border-destructive/30 bg-destructive/10 text-destructive", label: "Flagged" },
};

/**
 * Shows the authenticated user's uploaded wallpapers with moderation status.
 * Hidden entirely for anonymous visitors.
 */
export function MyUploads() {
  const { data: session, status } = useSession();
  const setSelectedSlug = useDiscovery((s) => s.setSelectedSlug);

  const { data, isLoading, refetch } = useQuery<Response>({
    queryKey: ["my-wallpapers"],
    queryFn: async () => {
      const res = await fetch("/api/v1/users/me/wallpapers?limit=12");
      if (!res.ok) throw new Error("Failed to load your uploads");
      return res.json();
    },
    enabled: status === "authenticated" && !!session?.user,
  });

  if (status !== "authenticated" || !session?.user) return null;

  const uploads = data?.data.items ?? [];
  const total = data?.data.pagination.total ?? 0;

  return (
    <AnimatePresence>
      {total > 0 || !isLoading ? (
        <motion.section
          id="my-uploads"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="border-b border-border bg-surface/40 py-12"
          aria-labelledby="my-uploads-heading"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="my-uploads-heading" className="font-display text-lg font-semibold text-foreground">
                  Your uploads
                </h2>
                <p className="mt-0.5 text-sm text-secondary-text">
                  {total > 0
                    ? `${total} wallpaper${total === 1 ? "" : "s"} · moderation status shown`
                    : "No uploads yet — share your first wallpaper."}
                </p>
              </div>
              <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/upload">
                  <UploadIcon size={16} className="mr-1.5" />
                  Upload wallpaper
                </Link>
              </Button>
            </div>

            {isLoading ? (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="aspect-square animate-shimmer rounded-xl border border-border" />
                ))}
              </div>
            ) : uploads.length > 0 ? (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {uploads.map((w, idx) => {
                  const statusCfg = STATUS_CONFIG[w.status] ?? STATUS_CONFIG.pending;
                  const StatusIcon = statusCfg.icon;
                  return (
                    <motion.div
                      key={w.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: idx * 0.05 }}
                      className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-surface"
                      onClick={() => w.status === "approved" && setSelectedSlug(w.slug)}
                    >
                      <div className="relative aspect-square overflow-hidden">
                        {w.gridAsset ? (
                          <img
                            src={w.gridAsset.objectKey}
                            alt={w.title}
                            className="absolute inset-0 h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-raised text-secondary-text">
                            <ImageIcon size={32} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                        <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
                          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", statusCfg.color)}>
                            <StatusIcon size={10} />
                            {statusCfg.label}
                          </span>
                          {(w.variationCount ?? w.variations?.length ?? 0) > 1 && (
                            <span className="rounded-full border border-primary/30 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-primary">
                              {w.variationCount ?? w.variations?.length} variations
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 p-3">
                        <p className="truncate text-sm font-medium text-foreground">{w.title}</p>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-secondary-text">
                          <span className="flex items-center gap-0.5">
                            <HeartIcon size={12} /> {w.likeCount}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <DownloadIcon size={12} /> {w.downloadCount}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <EyeIcon size={12} /> {w.viewCount}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-raised/40 p-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UploadIcon size={24} />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">No uploads yet</p>
                  <p className="mt-0.5 text-xs text-secondary-text">
                    Upload a wallpaper to see it here with real Sharp-processed variants.
                  </p>
                </div>
                <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link href="/upload">
                    <UploadIcon size={16} className="mr-1.5" />
                    Upload your first wallpaper
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
