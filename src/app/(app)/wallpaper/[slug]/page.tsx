"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { useDiscovery } from "@/stores/discovery";
import { WallpaperDetailDialog } from "@/components/landing/wallpaper-detail-dialog";

/**
 * Deep-linkable wallpaper detail. The same dialog used by the discovery grid
 * is opened from the URL so shared links resolve to the exact wallpaper.
 */
export default function WallpaperPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const setSelectedSlug = useDiscovery((s) => s.setSelectedSlug);
  const selectedSlug = useDiscovery((s) => s.selectedSlug);

  React.useEffect(() => {
    if (slug) setSelectedSlug(slug);
    return () => setSelectedSlug(null);
  }, [slug, setSelectedSlug]);

  return (
    <main className="min-h-screen bg-background">
      {!selectedSlug && (
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="font-medium text-foreground">Wallpaper detail closed</p>
          <p className="mt-1 text-sm text-secondary-text">
            Browse the library to open another wallpaper.
          </p>
          <Link
            href="/discover"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to Discover
          </Link>
        </div>
      )}
      <WallpaperDetailDialog />
    </main>
  );
}
