"use client";

import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";

import { SectionHeading } from "./section-heading";
import { Button } from "@/components/ui/button";
import { useWaitlistDialog } from "@/stores/waitlist";

export function FoundingCreators() {
  const openWaitlist = useWaitlistDialog((s) => s.openWith);

  return (
    <section
      id="creators"
      className="relative overflow-hidden py-20 sm:py-28"
      aria-labelledby="creators-heading"
    >
      <div className="absolute inset-0 bg-wallora-grain opacity-40" aria-hidden />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface to-background p-8 shadow-premium sm:p-12"
        >
          <div
            className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/15 blur-3xl"
            aria-hidden
          />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <SectionHeading
                eyebrow="Founding creators"
                title={<>Become a founding creator</>}
                subtitle="WALLORA is being built, not broadcast. There are no fake trending creators here — the community opens once the library ships. Founding creators get priority onboarding, verified status and early marketplace access."
              />
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold-glow"
                  onClick={() => openWaitlist("creator")}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Apply to the founding cohort
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-border bg-transparent text-foreground hover:bg-surface"
                  asChild
                >
                  <a href="#marketplace">
                    See the marketplace vision
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            <ul className="grid gap-3 rounded-xl border border-border bg-background/60 p-5">
              {[
                "Verified creator badge from day one",
                "Priority access to AI Studio (Phase 6)",
                "Early marketplace storefront (Phase 9)",
                "Founding cohort profile featured at launch",
              ].map((perk) => (
                <li key={perk} className="flex items-start gap-2.5 text-sm text-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {perk}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
