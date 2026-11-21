"use client";

import { motion } from "framer-motion";

import { SectionHeading } from "./section-heading";
import { ChatIcon, WandIcon, SparklesIcon, ShareIcon } from "@/components/icons/wallora-icons";

const STEPS = [
  {
    icon: ChatIcon,
    step: "01",
    title: "Describe your idea",
    description:
      "Open WALLORA AI Chat and describe what you imagine — in plain language. No prompt engineering required.",
  },
  {
    icon: WandIcon,
    step: "02",
    title: "Refine with AI",
    description:
      "The assistant enhances your prompt, suggests styles, and selects the right creative tool for the job.",
  },
  {
    icon: SparklesIcon,
    step: "03",
    title: "Generate & polish",
    description:
      "AI Studio generates the visual. Iterate with variations, presets and edits until it feels right.",
  },
  {
    icon: ShareIcon,
    step: "04",
    title: "Save, share or sell",
    description:
      "Save it to a project, publish to your profile, or list it in the marketplace and earn.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28" aria-labelledby="how-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="How WALLORA works"
          title={<>From idea to creation in four moves</>}
          subtitle="A single creative flow that takes you from a thought to a finished, shareable, sellable work."
          align="center"
          className="mx-auto items-center"
        />

        <div className="relative mt-14">
          <div
            className="absolute left-0 right-0 top-[44px] hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block"
            aria-hidden
          />
          <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              return (
                <motion.li
                  key={s.step}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.6, delay: idx * 0.08 }}
                  className="relative flex flex-col items-center text-center"
                >
                  <span className="relative z-10 flex h-[88px] w-[88px] items-center justify-center rounded-2xl border border-border bg-raised text-primary shadow-premium">
                    <Icon size={32} />
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-[10px] font-semibold text-primary">
                      {s.step}
                    </span>
                  </span>
                  <h3 className="mt-5 font-display text-base font-semibold text-foreground">
                    {s.title}
                  </h3>
                  <p className="mt-2 max-w-[260px] text-sm leading-relaxed text-secondary-text">
                    {s.description}
                  </p>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
