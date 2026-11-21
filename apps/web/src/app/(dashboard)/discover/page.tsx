"use client";

import { useState } from "react";
import { ImageCard } from "@/components/wallora/image-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Search, SlidersHorizontal } from "lucide-react";

const categories = ["All", "Nature", "Technology", "Architecture", "Minimalism", "Luxury", "Abstract"];

export default function DiscoverPage() {
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");

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

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              cat === c ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>Sort:</span>
        {["Trending", "Latest", "Most liked", "Most downloaded"].map((s) => (
          <button key={s} className="rounded-full border border-border px-2.5 py-1 hover:text-foreground">{s}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <ImageCard key={i} title={`Wallpaper ${i + 1}`} creator={`creator${i + 1}`} src="" />
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Placeholder grid — real library arrives in Phase 3.
      </p>
    </div>
  );
}