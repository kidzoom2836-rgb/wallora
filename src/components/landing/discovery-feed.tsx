"use client";

import * as React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Search, Loader2, RefreshCw, ImageIcon, ArrowDown, UploadCloud } from "lucide-react";

import { SectionHeading } from "./section-heading";
import { WallpaperCard, type WallpaperSummary } from "./wallpaper-card";
import { WallpaperDetailDialog } from "./wallpaper-detail-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDiscovery, type SortOption } from "@/stores/discovery";
import { useUploadDialog } from "@/stores/upload";
import { useAuthDialog } from "@/stores/auth-dialog";
import { cn } from "@/lib/utils";

type WallpapersResponse = {
  data: {
    items: WallpaperSummary[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  };
};

const SORT_LABELS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most liked" },
  { value: "downloads", label: "Most downloaded" },
];

export function DiscoveryFeed() {
  const { query, category, sort, setQuery, setSort } = useDiscovery();
  const [searchInput, setSearchInput] = React.useState(query);
  const { data: session } = useSession();
  const openUpload = useUploadDialog((s) => s.openUpload);
  const openSignIn = useAuthDialog((s) => s.openSignIn);
  const authenticated = !!session?.user;

  // Debounce search input → store
  React.useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput, setQuery]);

  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isLoading, isError, refetch } =
    useInfiniteQuery<WallpapersResponse>({
      queryKey: ["wallpapers", { query, category, sort }],
      queryFn: async ({ pageParam }) => {
        const params = new URLSearchParams({
          limit: "12",
          page: String(pageParam),
          sort,
        });
        if (query) params.set("q", query);
        if (category) params.set("category", category);
        const res = await fetch(`/api/v1/wallpapers?${params}`);
        if (!res.ok) throw new Error("Failed to load wallpapers");
        return res.json();
      },
      initialPageParam: 1,
      getNextPageParam: (lastPage) => {
        const { page, totalPages } = lastPage.data.pagination;
        return page < totalPages ? page + 1 : undefined;
      },
    });

  const wallpapers = React.useMemo(
    () => data?.pages.flatMap((p) => p.data.items) ?? [],
    [data],
  );

  const total = data?.pages[0]?.data.pagination.total ?? 0;

  return (
    <section id="discover" className="relative py-20 sm:py-24" aria-labelledby="discover-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Discovery"
          title={<>Explore the WALLORA library</>}
          subtitle="Real database-backed wallpapers with search, filters, likes and saves. Every visual is a genuine record — no fake arrays."
        />

        {/* Controls bar */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-text" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search wallpapers, descriptions, moods…"
              className="border-border bg-surface pl-9"
              aria-label="Search wallpapers"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-secondary-text hover:text-foreground"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {category && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                {category}
                <button
                  type="button"
                  onClick={() => useDiscovery.getState().setCategory("")}
                  className="hover:opacity-70"
                  aria-label="Clear category filter"
                >
                  ✕
                </button>
              </span>
            )}
            {authenticated && (
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={openUpload}
              >
                <UploadCloud className="mr-1.5 h-4 w-4" />
                Upload
              </Button>
            )}
            {!authenticated && (
              <Button
                size="sm"
                variant="outline"
                className="border-border bg-surface text-foreground hover:bg-raised"
                onClick={openSignIn}
              >
                <UploadCloud className="mr-1.5 h-4 w-4" />
                Upload
              </Button>
            )}
            <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
              <SelectTrigger className="w-[140px] border-border bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover">
                {SORT_LABELS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Result count */}
        <div className="mt-4 flex items-center justify-between text-xs text-secondary-text">
          <span>
            {isLoading ? "Loading…" : `${total} wallpaper${total === 1 ? "" : "s"}`}
            {query && ` for "${query}"`}
            {category && ` in ${category}`}
          </span>
          {isFetching && !isLoading && (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> refreshing
            </span>
          )}
        </div>

        {/* States */}
        {isLoading ? (
          <SkeletonGrid />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : wallpapers.length === 0 ? (
          <EmptyState query={query} category={category} onClear={() => { setSearchInput(""); useDiscovery.getState().setCategory(""); }} />
        ) : (
          <>
            {/* Masonry-style grid using CSS columns for varied heights */}
            <div className="mt-6 columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
              {wallpapers.map((w, idx) => (
                <WallpaperCard key={w.id} wallpaper={w} index={idx} />
              ))}
            </div>

            {/* Load more */}
            {hasNextPage && (
              <div className="mt-10 flex justify-center">
                <Button
                  variant="outline"
                  className="border-border bg-surface text-foreground hover:bg-raised"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    <>
                      <ArrowDown className="mr-2 h-4 w-4" />
                      Load more
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <WallpaperDetailDialog />
    </section>
  );
}

function SkeletonGrid() {
  return (
    <div className="mt-6 columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "animate-shimmer rounded-xl border border-border",
            i % 3 === 0 ? "aspect-[3/4]" : i % 3 === 1 ? "aspect-square" : "aspect-[16/9]",
          )}
        />
      ))}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-border bg-surface p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <RefreshCw className="h-6 w-6" />
      </span>
      <div>
        <p className="font-medium text-foreground">Could not load wallpapers</p>
        <p className="mt-1 text-sm text-secondary-text">Something went wrong fetching the library.</p>
      </div>
      <Button variant="outline" className="border-border bg-raised" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function EmptyState({ query, category, onClear }: { query: string; category: string; onClear: () => void }) {
  return (
    <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-border bg-surface p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ImageIcon className="h-6 w-6" />
      </span>
      <div>
        <p className="font-medium text-foreground">No wallpapers found</p>
        <p className="mt-1 text-sm text-secondary-text">
          {query
            ? `Nothing matches "${query}"${category ? ` in ${category}` : ""} yet.`
            : category
              ? `No wallpapers in ${category} yet.`
              : "The library is empty."}
        </p>
      </div>
      {(query || category) && (
        <Button variant="outline" className="border-border bg-raised" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
