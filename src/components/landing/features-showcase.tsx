"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import {
  SearchIcon,
  ChatIcon,
  SparklesIcon,
  StoreIcon,
  ArrowRightIcon,
} from "@/components/icons/wallora-icons";

const FEATURES = [
  {
    href: "/discover",
    title: "Discover",
    description: "Browse thousands of wallpapers with smart search, filters and categories.",
    icon: SearchIcon,
    accent: "from-amber-500/10 to-transparent",
  },
  {
    href: "/ai",
    title: "AI Chat",
    description: "Talk to WALLORA AI in 9 creative modes — from design to storytelling.",
    icon: ChatIcon,
    accent: "from-purple-500/10 to-transparent",
  },
  {
    href: "/studio",
    title: "AI Studio",
    description: "Generate original artwork with 12 style presets and real image generation.",
    icon: SparklesIcon,
    accent: "from-rose-500/10 to-transparent",
  },
  {
    href: "/marketplace",
    title: "Marketplace",
    description: "Browse and purchase premium wallpaper packs from creators.",
    icon: StoreIcon,
    accent: "from-emerald-500/10 to-transparent",
  },
];

export function FeaturesShowcase() {
  return (
    <section className="border-b border-border bg-surface/30 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Everything you need to create
          </h2>
          <p className="mt-3 text-base text-secondary-text">
            Four powerful tools, one creative ecosystem.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, idx) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.href}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
              >
                <Link
                  href={f.href}
                  className="group relative block overflow-hidden rounded-2xl border border-border bg-raised p-6 transition-colors hover:border-primary/40"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${f.accent} opacity-0 transition-opacity group-hover:opacity-100`} />
                  <div className="relative">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface text-primary transition-transform group-hover:scale-105">
                      <Icon size={24} />
                    </span>
                    <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                      {f.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-secondary-text">
                      {f.description}
                    </p>
                    <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Open <ArrowRightIcon size={14} />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
