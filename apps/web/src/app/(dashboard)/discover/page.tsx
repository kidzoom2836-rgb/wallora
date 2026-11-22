"use client";

import { useState, useEffect } from "react";
import { ImageCard } from "@/components/wallora/image-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";

interface Wallpaper { id: string; title: string; imageUrl: string; thumbnailUrl: string | null; likes: number; downloads: number; likedByMe: boolean; }

export default function DiscoverPage() {
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/v1/wallpapers").then((r) => r.json()).then((d) => { setWallpapers(d.wallpapers ?? []); setLoading(false); });
  }, []);

  const filtered = wallpapers.filter((w) => w.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">Discover</h1>
        <div className="flex gap-2">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9" />
          </div>
          <Button variant="outline" size="icon" aria-label="Filters">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No wallpapers yet. Run seed to add samples.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((w) => (
            <a key={w.id} href={`/wallpapers/${w.id}`} className="no-underline">
              <ImageCard title={w.title} creator="creator" src={w.thumbnailUrl || w.imageUrl} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
EOF