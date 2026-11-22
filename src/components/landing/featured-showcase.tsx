"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

import { SectionHeading } from "./section-heading";
import { Badge } from "@/components/ui/badge";
import { SHOWCASE } from "@/lib/landing-data";
import { cn } from "@/lib/utils";

const SPAN_CLASS: Record<string, string> = {
  tall: "row-span-2",
  short: "row-span-1",
  square: "row-span-1",
  wide: "col-span-2",
};

export function FeaturedShowcase() {
  return (
    <section id="discover" className="relative py-20 sm:py-28" aria-labelledby="discover-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow="Featured showcase"
            title={<>A concept gallery of what WALLORA can imagine</>}
            subtitle="A concept gallery of AI-generated sample visuals. Explore real creator wallpapers in the live library."
          />
          <Badge
            variant="outline"
            className="hidden w-fit border-border bg-surface text-secondary-text sm:inline-flex"
          >
            Live library in Discover
          </Badge>
        </div>

        <div className="mt-10 grid auto-rows-[180px] grid-cols-2 gap-4 sm:auto-rows-[220px] lg:grid-cols-4">
          {SHOWCASE.map((item, idx) => (
            <motion.figure
              key={item.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.6,
                delay: idx * 0.06,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={cn(
                "group relative overflow-hidden rounded-xl border border-border bg-surface",
                SPAN_CLASS[item.span],
              )}
            >
              <img
                src={item.src}
                alt={`${item.title} — ${item.category} concept sample`}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-80 transition-opacity group-hover:opacity-95" />
              <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="text-xs text-secondary-text">{item.category}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full border border-border bg-background/70 px-2 py-0.5 text-[10px] font-medium text-secondary-text backdrop-blur">
                    AI sample
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/70 text-foreground opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
