"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Loader2, UploadCloud } from "lucide-react";

import { WallpaperCard, type WallpaperSummary } from "@/components/landing/wallpaper-card";
import { WallpaperDetailDialog } from "@/components/landing/wallpaper-detail-dialog";
import { Button } from "@/components/ui/button";
import { useAuthDialog } from "@/stores/auth-dialog";

type FavoriteItem = {
  favoritedAt: string;
  wallpaper: {
    id: string;
    slug: string;
    title: string;
    orientation: string;
    dominantColor: string | null;
    likeCount: number;
    favoriteCount: number;
    downloadCount: number;
    createdAt: string;
    category: { slug: string; name: string } | null;
    creator: {
      username: string | null;
      displayName: string | null;
      verified: boolean;
    };
    asset: { objectKey: string; width: number; height: number } | null;
    tags: { slug: string; name: string }[];
  };
};

type FavoritesResponse = {
  data: { items: FavoriteItem[]; pagination: { total: number } };
};

export default function FavoritesPage() {
  const { status } = useSession();
  const openSignIn = useAuthDialog((s) => s.openSignIn);

  const query = useQuery<FavoritesResponse>({
    queryKey: ["favorites"],
    enabled: status === "authenticated",
    queryFn: async () => {
      const res = await fetch("/api/v1/favorites?limit=24");
      if (!res.ok) throw new Error("Could not load your saved wallpapers.");
      return res.json();
    },
  });

  const items: WallpaperSummary[] = (query.data?.data.items ?? []).map(({ wallpaper: w }) => ({
    id: w.id,
    slug: w.slug,
    title: w.title,
    description: null,
    orientation: w.orientation,
    dominantColor: w.dominantColor,
    license: "",
    sourceType: "",
    likeCount: w.likeCount,
    favoriteCount: w.favoriteCount,
    downloadCount: w.downloadCount,
    viewCount: 0,
    createdAt: w.createdAt,
    category: w.category,
    creator: {
      id: w.creator.username ?? "",
      username: w.creator.username,
      displayName: w.creator.displayName,
      verified: w.creator.verified,
      tier: "free",
    },
    asset: w.asset,
    variationCount: 1,
    variations: [],
    tags: w.tags,
    liked: false,
    favorited: true,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your library</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Saved wallpapers</h1>
          <p className="mt-2 text-sm text-secondary-text">
            Everything you bookmarked from the WALLORA library.
          </p>
        </div>
        <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/discover">
            <Bookmark className="mr-2 size-4" />
            Find more wallpapers
          </Link>
        </Button>
      </header>

      {status === "unauthenticated" ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <UploadCloud className="mx-auto size-8 text-primary" />
          <p className="mt-4 text-sm font-medium text-foreground">Sign in to see your saved wallpapers</p>
          <Button className="mt-5 bg-primary text-primary-foreground" onClick={() => openSignIn()}>
            Sign in
          </Button>
        </div>
      ) : query.isLoading ? (
        <div className="mt-10 flex items-center justify-center gap-2 rounded-xl border border-border bg-surface py-20 text-sm text-secondary-text">
          <Loader2 className="size-4 animate-spin" />
          Loading saved wallpapers…
        </div>
      ) : query.isError ? (
        <div className="mt-10 rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
          {(query.error as Error).message ?? "Could not load your saved wallpapers."}
        </div>
      ) : items.length > 0 ? (
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((wallpaper, index) => (
            <WallpaperCard key={wallpaper.id} wallpaper={wallpaper} index={index} />
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <Bookmark className="mx-auto size-8 text-primary" />
          <p className="mt-4 text-sm font-medium text-foreground">Nothing saved yet</p>
          <p className="mt-1 text-xs text-secondary-text">
            Tap the bookmark on any wallpaper to keep it here.
          </p>
          <Button asChild className="mt-5 bg-primary text-primary-foreground">
            <Link href="/discover">Browse wallpapers</Link>
          </Button>
        </div>
      )}

      <WallpaperDetailDialog />
    </div>
  );
}
