"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LayoutGrid, Loader2 } from "lucide-react";

import { WallpaperCard, type WallpaperSummary } from "@/components/landing/wallpaper-card";
import { WallpaperDetailDialog } from "@/components/landing/wallpaper-detail-dialog";
import { Button } from "@/components/ui/button";
import { COLLECTIONS, COLLECTION_FILTERS } from "@/lib/landing-data";

type WallpapersResponse = {
  data: {
    items: WallpaperSummary[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  };
};

export default function CollectionPage() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
  const collection = COLLECTIONS.find((c) => c.id === id);
  const filter = COLLECTION_FILTERS[id];

  const query = useQuery<WallpaperSummary[]>({
    queryKey: ["collection", id],
    enabled: !!filter,
    queryFn: async () => {
      const responses = await Promise.all(
        filter.terms.map(async (term) => {
          const res = await fetch(
            `/api/v1/wallpapers?q=${encodeURIComponent(term)}&sort=popular&limit=24`,
          );
          if (!res.ok) throw new Error("Could not load this collection.");
          const body = (await res.json()) as WallpapersResponse;
          return body.data.items;
        }),
      );

      const seen = new Set<string>();
      const merged: WallpaperSummary[] = [];
      for (const item of responses.flat()) {
        if (seen.has(item.slug)) continue;
        seen.add(item.slug);
        merged.push(item);
      }
      return merged
        .sort((a, b) => b.likeCount + b.downloadCount - (a.likeCount + a.downloadCount))
        .slice(0, 48);
    },
  });

  if (!collection || !filter) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-foreground">Collection not found</h1>
        <p className="mt-2 text-sm text-secondary-text">
          This curated collection is no longer available.
        </p>
        <Button asChild className="mt-6 bg-primary text-primary-foreground">
          <Link href="/discover">Browse all wallpapers</Link>
        </Button>
      </div>
    );
  }

  const items = query.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Button asChild variant="ghost" className="mb-6 text-secondary-text hover:text-foreground">
        <Link href="/#collections">
          <ArrowLeft className="mr-2 size-4" />
          All collections
        </Link>
      </Button>

      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Curated collection
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground">{collection.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-secondary-text">{filter.intro}</p>
        </div>
        <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/discover">
            <LayoutGrid className="mr-2 size-4" />
            Explore everything
          </Link>
        </Button>
      </header>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border">
        <img
          src={collection.src}
          alt={`${collection.title} cover`}
          className="h-48 w-full object-cover sm:h-64"
        />
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-foreground">Wallpapers in this world</h2>
        {query.isSuccess && (
          <span className="text-xs text-secondary-text">
            {items.length} result{items.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {query.isLoading ? (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-border bg-surface py-20 text-sm text-secondary-text">
          <Loader2 className="size-4 animate-spin" />
          Loading collection…
        </div>
      ) : query.isError ? (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
          {(query.error as Error).message ?? "Could not load this collection."}
        </div>
      ) : items.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((wallpaper, index) => (
            <WallpaperCard key={wallpaper.id} wallpaper={wallpaper} index={index} />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center">
          <p className="text-sm font-medium text-foreground">No wallpapers match this collection yet</p>
          <p className="mt-1 text-xs text-secondary-text">
            Publish a wallpaper using these themes and it will appear here automatically.
          </p>
          <Button asChild className="mt-5 bg-primary text-primary-foreground">
            <Link href="/upload">Upload a wallpaper</Link>
          </Button>
        </div>
      )}

      <WallpaperDetailDialog />
    </div>
  );
}
