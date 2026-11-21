"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

import { SectionHeading } from "./section-heading";
import { Badge } from "@/components/ui/badge";
import { STUDIOS } from "@/lib/landing-data";

export function CreativeTools() {
  return (
    <section
      id="tools"
      className="relative border-y border-border bg-surface/40 py-20 sm:py-28"
      aria-labelledby="tools-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Creative studios"
          title={<>A studio for every kind of creative</>}
          subtitle="WALLORA ships a shared conversation engine plus specialized studios — each tuned for a different creative discipline."
          align="center"
          className="mx-auto items-center"
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STUDIOS.map((studio, idx) => {
            const Icon = studio.icon;
            return (
              <motion.article
                key={studio.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{
                  duration: 0.6,
                  delay: idx * 0.05,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="group relative overflow-hidden rounded-xl border border-border bg-raised/60 p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface text-primary transition-transform group-hover:scale-105">
                    <Icon className="h-5 w-5" />
                  </span>
                  <Badge
                    variant="outline"
                    className="border-border bg-surface text-[10px] text-secondary-text"
                  >
                    {studio.phase}
                  </Badge>
                </div>
                <h3 className="mt-4 font-display text-base font-semibold text-foreground">
                  {studio.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-secondary-text">
                  {studio.description}
                </p>
                <div className="mt-4 flex items-center gap-1 text-xs font-medium text-secondary-text transition-colors group-hover:text-primary">
                  Planned
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
