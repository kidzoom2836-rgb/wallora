"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

import { ArrowRightIcon, DownloadIcon, HeartIcon, SparklesIcon } from "@/components/icons/wallora-icons";
import { Button } from "@/components/ui/button";

type LiveWallpaper = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  likeCount: number;
  downloadCount: number;
  asset: { objectKey: string } | null;
  creator: { displayName: string | null; username: string | null; verified: boolean };
};

type WallpapersResponse = { data: { items: LiveWallpaper[]; pagination: { total: number } } };

const ROTATE_MS = 5200;

/**
 * Realtime-feeling showcase backed by the live wallpaper API. Rotates through
 * the most-liked approved wallpapers with a crossfade, shows a live pulse, and
 * refreshes the trending set + totals every 60 seconds so new uploads appear
 * without a page reload.
 */
export function LiveShowcase() {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  const { data, isLoading } = useQuery<WallpapersResponse>({
    queryKey: ["home-live-showcase"],
    queryFn: async () => {
      const res = await fetch("/api/v1/wallpapers?sort=popular&limit=8", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const items = data?.data.items ?? [];
  const total = data?.data.pagination.total ?? 0;

  React.useEffect(() => {
    if (paused || items.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused, items.length]);

  const active = items[index % Math.max(items.length, 1)];

  return (
    <section
      id="live"
      className="relative overflow-hidden border-y border-border bg-surface/30 py-16 sm:py-20"
      aria-labelledby="live-heading"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              Live from WALLORA
            </div>
            <h2 id="live-heading" className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
              Trending right now
            </h2>
            <p className="mt-1 text-sm text-secondary-text">
              Real wallpapers from the community, updating as the library grows.
            </p>
          </div>
          <div className="flex gap-6 text-center">
            <LiveStat label="Wallpapers" value={total} loading={isLoading} />
            <LiveStat label="In rotation" value={items.length} loading={isLoading} />
          </div>
        </div>

        <div className="grid items-stretch gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Main rotating stage */}
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-background shadow-premium">
            <AnimatePresence mode="wait">
              {active ? (
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.99 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0"
                >
                  {active.asset ? (
                    <img
                      src={active.asset.objectKey}
                      alt={active.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full animate-shimmer" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
                    <div className="flex items-center gap-2 text-xs text-primary">
                      <SparklesIcon size={14} />
                      @{active.creator.username ?? "creator"}
                      {active.creator.verified && <span className="size-3 rounded-full bg-primary" />}
                    </div>
                    <h3 className="mt-1 font-display text-xl font-semibold text-foreground sm:text-2xl">
                      {active.title}
                    </h3>
                    {active.description && (
                      <p className="mt-1 line-clamp-2 max-w-lg text-sm text-secondary-text">
                        {active.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-4 text-xs text-secondary-text">
                      <span className="inline-flex items-center gap-1">
                        <HeartIcon size={14} /> {active.likeCount}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <DownloadIcon size={14} /> {active.downloadCount}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="absolute inset-0 animate-shimmer" />
              )}
            </AnimatePresence>

            {/* Progress dots */}
            <div className="absolute right-4 top-4 flex gap-1.5">
              {items.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Show ${item.title}`}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index % Math.max(items.length, 1) ? "w-6 bg-primary" : "w-1.5 bg-foreground/30"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Now-trending list */}
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface/60 p-4">
            <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-[0.16em] text-secondary-text">
              Now trending
            </p>
            <div className="flex-1 space-y-1.5 overflow-hidden">
              {items.slice(0, 6).map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition ${
                    i === index % Math.max(items.length, 1)
                      ? "border-primary/40 bg-primary/10"
                      : "border-transparent hover:border-border hover:bg-raised"
                  }`}
                >
                  <span className="w-5 shrink-0 text-center font-display text-sm font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="size-10 shrink-0 overflow-hidden rounded-md border border-border bg-background">
                    {item.asset ? (
                      <img src={item.asset.objectKey} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{item.title}</span>
                    <span className="block truncate text-xs text-secondary-text">
                      @{item.creator.username ?? "creator"} · {item.downloadCount} downloads
                    </span>
                  </span>
                </button>
              ))}
              {!isLoading && items.length === 0 && (
                <p className="p-4 text-center text-sm text-secondary-text">
                  Wallpapers will appear here once the community publishes approved work.
                </p>
              )}
            </div>
            <Button variant="ghost" className="mt-2 justify-between text-primary hover:text-primary" asChild>
              <Link href="/discover">
                Explore all wallpapers
                <ArrowRightIcon size={16} />
              </Link>
            </Button>
          </div>
        </div>

        {/* Marquee ticker */}
        {items.length > 2 && (
          <div className="relative mt-8 overflow-hidden rounded-lg border border-border bg-background/60 py-2">
            <div className="flex w-max animate-marquee gap-8 whitespace-nowrap text-xs text-secondary-text">
              {[...items, ...items].map((item, i) => (
                <span key={`${item.id}-${i}`} className="inline-flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-primary" />
                  {item.title} · @{item.creator.username ?? "creator"} · {item.likeCount} likes
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function LiveStat({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="min-w-[80px]">
      <p className="font-display text-2xl font-bold text-foreground">
        {loading ? "—" : value.toLocaleString()}
      </p>
      <p className="text-xs text-secondary-text">{label}</p>
    </div>
  );
}
