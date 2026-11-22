"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

import { SectionHeading } from "./section-heading";
import { COLLECTIONS } from "@/lib/landing-data";

export function FeaturedCollections() {
  return (
    <section
      id="collections"
      className="relative py-20 sm:py-28"
      aria-labelledby="collections-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow="Curated collections"
            title={<>Hand-picked worlds, ready to dive into</>}
            subtitle="Curated entry points into the live WALLORA library. Each collection opens real, searchable wallpapers."
          />
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {COLLECTIONS.map((collection, idx) => (
            <Link
              key={collection.id}
              href={`/collections/${collection.id}`}
              className="group relative block overflow-hidden rounded-xl border border-border bg-surface text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{
                  duration: 0.6,
                  delay: idx * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
                whileHover={{ y: -4 }}
              >
                <div className="aspect-[16/9] overflow-hidden">
                  <img
                    src={collection.src}
                    alt={`${collection.title} collection cover`}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent p-5 pt-12">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-semibold text-foreground">
                        {collection.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-secondary-text">
                        {collection.description}
                      </p>
                      <p className="mt-2 text-[11px] font-medium text-primary">
                        Explore this collection
                      </p>
                    </div>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/70 text-foreground backdrop-blur transition-colors group-hover:border-primary/40 group-hover:text-primary">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
