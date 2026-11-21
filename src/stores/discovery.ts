"use client";

import { create } from "zustand";

export type SortOption = "newest" | "popular" | "downloads";

type DiscoveryState = {
  query: string;
  category: string; // "" = all
  sort: SortOption;
  selectedSlug: string | null;
  setQuery: (q: string) => void;
  setCategory: (c: string) => void;
  setSort: (s: SortOption) => void;
  setSelectedSlug: (slug: string | null) => void;
  reset: () => void;
};

/**
 * Coordinates discovery feed state (search, filters, sort) and the wallpaper
 * detail dialog across components. ExploreCategories can set the category;
 * DiscoveryFeed reads it; WallpaperCard opens the detail dialog.
 */
export const useDiscovery = create<DiscoveryState>((set) => ({
  query: "",
  category: "",
  sort: "newest",
  selectedSlug: null,
  setQuery: (query) => set({ query }),
  setCategory: (category) => set({ category }),
  setSort: (sort) => set({ sort }),
  setSelectedSlug: (selectedSlug) => set({ selectedSlug }),
  reset: () => set({ query: "", category: "", sort: "newest" }),
}));
