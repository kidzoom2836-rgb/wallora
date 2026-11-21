"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { toast } from "sonner";

import { SectionHeading } from "./section-heading";
import { useDiscovery } from "@/stores/discovery";
import { cn } from "@/lib/utils";

type CategoryItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  wallpaperCount: number;
};

type CategoriesResponse = { data: CategoryItem[] };

const FALLBACK_ICONS = ["Leaf", "Cpu", "Car", "Sparkles", "Gamepad2", "Building2", "Ruler", "Gem", "Shapes", "Aperture", "Shirt", "Armchair", "Brush"];

function getIcon(name: string | null, index: number) {
  const iconName = name ?? FALLBACK_ICONS[index % FALLBACK_ICONS.length];
  const Icon = (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>)[iconName];
  return Icon ?? LucideIcons.Tag;
}

export function ExploreCategories() {
  const { category, setCategory } = useDiscovery();

  const { data, isLoading } = useQuery<CategoriesResponse>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/v1/categories");
      if (!res.ok) throw new Error("Failed to load categories");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // categories rarely change
  });

  const categories = data?.data ?? [];

  const handleClick = (slug: string, name: string) => {
    if (category === slug) {
      setCategory("");
      toast.info("Category filter cleared");
    } else {
      setCategory(slug);
      toast.success(`Filtering: ${name}`, {
        description: "Scroll to the discovery grid to see results.",
      });
      // Smooth scroll to the discovery section
      setTimeout(() => {
        document.getElementById("discover")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  };

  return (
    <section
      id="categories"
      className="relative border-y border-border bg-surface/40 py-20 sm:py-24"
      aria-labelledby="categories-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Explore categories"
          title="Thirteen worlds of visual inspiration"
          subtitle="Click a category to filter the discovery grid. Categories are backed by real wallpaper counts."
        />

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {isLoading
            ? Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-[72px] animate-shimmer rounded-xl border border-border" />
              ))
            : categories.map((cat, idx) => {
                const Icon = getIcon(cat.icon, idx);
                const active = category === cat.slug;
                return (
                  <motion.button
                    key={cat.id}
                    type="button"
                    onClick={() => handleClick(cat.slug, cat.name)}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.5, delay: idx * 0.03 }}
                    whileHover={{ y: -3 }}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-primary/50 bg-primary/10 ring-gold"
                        : "border-border bg-raised/60 hover:border-primary/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors",
                        active
                          ? "border-primary/30 bg-primary/15 text-primary"
                          : "border-border bg-surface text-secondary-text group-hover:text-primary",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {cat.name}
                      </span>
                      <span className="block text-xs text-secondary-text">
                        {cat.wallpaperCount} {cat.wallpaperCount === 1 ? "wallpaper" : "wallpapers"}
                      </span>
                    </span>
                  </motion.button>
                );
              })}
        </div>
      </div>
    </section>
  );
}
