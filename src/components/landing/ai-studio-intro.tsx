"use client";

import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  Wand2,
  Sparkles,
  Layers,
  GalleryHorizontalEnd,
  Repeat2,
  History,
  Check,
} from "lucide-react";

import { SectionHeading } from "./section-heading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWaitlistDialog } from "@/stores/waitlist";
import { useAuthDialog } from "@/stores/auth-dialog";
import { useAiStudio } from "@/stores/ai-studio";

const FEATURES = [
  { icon: Wand2, label: "Text-to-image generation" },
  { icon: Sparkles, label: "Prompt enhancement" },
  { icon: Layers, label: "Style presets & aspect ratios" },
  { icon: GalleryHorizontalEnd, label: "Variations & history" },
  { icon: Repeat2, label: "Retry & regenerate" },
  { icon: History, label: "Saved outputs & projects" },
];

export function AiStudioIntro() {
  const openWaitlist = useWaitlistDialog((s) => s.openWith);
  const openStudio = useAiStudio((s) => s.openStudio);
  const openSignIn = useAuthDialog((s) => s.openSignIn);
  const { data: session, status } = useSession();
  const authenticated = status === "authenticated" && !!session?.user;

  const handleOpenStudio = () => {
    if (authenticated) {
      openStudio();
    } else {
      openSignIn();
    }
  };

  return (
    <section id="studio" className="relative py-20 sm:py-28" aria-labelledby="studio-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left — copy */}
          <div>
            <SectionHeading
              eyebrow="WALLORA AI Studio"
              title={<>One workspace for every creative impulse</>}
              subtitle="Real text-to-image generation with prompt enhancement, 11 style presets, aspect ratios, variations and full generation history — backed by a capability-based AI provider."
            />

            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {FEATURES.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <motion.li
                    key={feature.label}
                    initial={{ opacity: 0, x: -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.5, delay: idx * 0.05 }}
                    className="flex items-center gap-3 rounded-lg border border-border bg-surface/60 p-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {feature.label}
                    </span>
                    <Check className="ml-auto h-4 w-4 text-primary/70" />
                  </motion.li>
                );
              })}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold-glow"
                onClick={handleOpenStudio}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {authenticated ? "Open AI Studio" : "Sign in to open Studio"}
              </Button>
              <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                Phase 6 · Live
              </Badge>
            </div>
          </div>

          {/* Right — preview image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative order-first lg:order-last"
          >
            <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-premium">
              <div className="aspect-[16/9] overflow-hidden">
                <img
                  src="/showcase/studio-preview.jpg"
                  alt="WALLORA AI Studio workspace preview — a dark premium creative interface generating abstract artwork"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3">
                <div className="rounded-xl border border-border bg-background/85 px-3 py-2 backdrop-blur">
                  <p className="text-xs font-medium text-foreground">AI Studio · preview</p>
                  <p className="text-[11px] text-secondary-text">Workspace concept</p>
                </div>
                <span className="rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium text-primary backdrop-blur">
                  Phase 6
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
