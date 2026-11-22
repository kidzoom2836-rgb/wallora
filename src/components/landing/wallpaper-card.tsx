"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Heart, Bookmark, ArrowUpRight, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { VerifiedTick } from "@/components/brand/verified-badge";
import { useAuthDialog } from "@/stores/auth-dialog";
import { useDiscovery } from "@/stores/discovery";

export type WallpaperSummary = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  orientation: string;
  dominantColor?: string | null;
  license: string;
  sourceType: string;
  likeCount: number;
  favoriteCount: number;
  downloadCount: number;
  viewCount: number;
  createdAt: string;
  category: { slug: string; name: string } | null;
  creator: {
    id: string;
    username: string | null;
    displayName: string | null;
    verified: boolean;
    tier?: "free" | "verified" | "premium" | "supreme";
  };
  asset: { objectKey: string; width: number; height: number } | null;
  tags: { slug: string; name: string }[];
  liked: boolean;
  favorited: boolean;
};

type WallpaperCardProps = {
  wallpaper: WallpaperSummary;
  index?: number;
};

const ASPECT_CLASS: Record<string, string> = {
  portrait: "aspect-[3/4]",
  landscape: "aspect-[16/9]",
  square: "aspect-square",
};

export function WallpaperCard({ wallpaper, index = 0 }: WallpaperCardProps) {
  const { data: session } = useSession();
  const authenticated = !!session?.user;
  const openSignIn = useAuthDialog((s) => s.openSignIn);
  const setSelectedSlug = useDiscovery((s) => s.setSelectedSlug);

  const [liked, setLiked] = React.useState(wallpaper.liked);
  const [favorited, setFavorited] = React.useState(wallpaper.favorited);
  const [likeCount, setLikeCount] = React.useState(wallpaper.likeCount);
  const [favoriteCount, setFavoriteCount] = React.useState(wallpaper.favoriteCount);

  React.useEffect(() => {
    setLiked(wallpaper.liked);
    setFavorited(wallpaper.favorited);
    setLikeCount(wallpaper.likeCount);
    setFavoriteCount(wallpaper.favoriteCount);
  }, [wallpaper.liked, wallpaper.favorited, wallpaper.likeCount, wallpaper.favoriteCount]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      const method = liked ? "DELETE" : "POST";
      const res = await fetch(`/api/v1/wallpapers/${wallpaper.slug}/like`, { method });
      if (!res.ok) throw new Error("like failed");
      return res.json();
    },
    onMutate: () => {
      // Optimistic update
      setLiked((prev) => !prev);
      setLikeCount((prev) => (liked ? Math.max(0, prev - 1) : prev + 1));
    },
    onError: () => {
      // Revert on error
      setLiked(wallpaper.liked);
      setLikeCount(wallpaper.likeCount);
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      const method = favorited ? "DELETE" : "POST";
      const res = await fetch(`/api/v1/wallpapers/${wallpaper.slug}/favorite`, { method });
      if (!res.ok) throw new Error("favorite failed");
      return res.json();
    },
    onMutate: () => {
      setFavorited((prev) => !prev);
      setFavoriteCount((prev) => (favorited ? Math.max(0, prev - 1) : prev + 1));
    },
    onError: () => {
      setFavorited(wallpaper.favorited);
      setFavoriteCount(wallpaper.favoriteCount);
    },
  });

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authenticated) {
      openSignIn();
      return;
    }
    likeMutation.mutate();
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authenticated) {
      openSignIn();
      return;
    }
    favoriteMutation.mutate();
  };

  const openDetail = () => setSelectedSlug(wallpaper.slug);

  const aspectClass = ASPECT_CLASS[wallpaper.orientation] ?? "aspect-square";

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-surface"
      onClick={openDetail}
      role="button"
      tabIndex={0}
      aria-label={`View ${wallpaper.title}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetail();
        }
      }}
    >
      {/* Image */}
      <div className={cn("relative overflow-hidden", aspectClass)}>
        {wallpaper.asset ? (
          <img
            src={wallpaper.asset.objectKey}
            alt={`${wallpaper.title} — ${wallpaper.category?.name ?? "wallpaper"}`}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 animate-shimmer" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/10 to-transparent opacity-70 transition-opacity group-hover:opacity-90" />

        {/* Top-right actions */}
        <div className="absolute right-2 top-2 flex gap-1.5">
          <button
            type="button"
            onClick={handleFavorite}
            disabled={favoriteMutation.isPending}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition-colors",
              favorited
                ? "border-primary bg-primary/20 text-primary"
                : "border-border bg-background/70 text-secondary-text hover:text-foreground",
            )}
            aria-label={favorited ? "Remove from saved" : "Save wallpaper"}
            aria-pressed={favorited}
          >
            {favoriteMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Bookmark className={cn("h-3.5 w-3.5", favorited && "fill-current")} />
            )}
          </button>
          <button
            type="button"
            onClick={handleLike}
            disabled={likeMutation.isPending}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition-colors",
              liked
                ? "border-destructive bg-destructive/20 text-destructive"
                : "border-border bg-background/70 text-secondary-text hover:text-foreground",
            )}
            aria-label={liked ? "Remove like" : "Like wallpaper"}
            aria-pressed={liked}
          >
            {likeMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />
            )}
          </button>
        </div>

        {/* Source badge */}
        <div className="absolute left-2 top-2">
          <span className="rounded-full border border-border bg-background/70 px-2 py-0.5 text-[10px] font-medium text-secondary-text backdrop-blur">
            {wallpaper.sourceType === "showcase" ? "Showcase" : wallpaper.sourceType}
          </span>
        </div>
      </div>

      {/* Caption */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{wallpaper.title}</p>
          <p className="truncate text-xs text-secondary-text">
            @{wallpaper.creator.username ?? "wallora"}
            <span className="ml-1 inline-flex align-middle">
              <VerifiedTick
                tier={
                  wallpaper.creator.tier ??
                  (wallpaper.creator.verified ? "verified" : "free")
                }
              />
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-secondary-text">
          <span className="flex items-center gap-0.5">
            <Heart className={cn("h-3 w-3", liked && "fill-destructive text-destructive")} />
            {likeCount}
          </span>
          <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <ArrowUpRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </motion.article>
  );
}
