"use client";

import { motion } from "framer-motion";

import { SectionHeading } from "./section-heading";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLANS } from "@/lib/landing-data";
import { useWaitlistDialog } from "@/stores/waitlist";
import { CheckIcon, SparklesIcon } from "@/components/icons/wallora-icons";

export function Pricing() {
  const openWaitlist = useWaitlistDialog((s) => s.openWith);

  return (
    <section
      id="pricing"
      className="relative border-y border-border bg-surface/40 py-20 sm:py-28"
      aria-labelledby="pricing-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Plans"
          title={<>Plans for every kind of imagination</>}
          subtitle="Start free. Upgrade when you create more. Sell when you are ready. Prices for paid tiers will be announced — they are never hardcoded."
          align="center"
          className="mx-auto items-center"
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {PLANS.map((plan, idx) => (
            <motion.article
              key={plan.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: idx * 0.08 }}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-background p-6",
                plan.highlight
                  ? "border-primary/50 shadow-gold-glow ring-gold"
                  : "border-border",
              )}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground">
                  Most popular
                </span>
              )}

              <div>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {plan.name}
                </h3>
                <p className="mt-1 text-xs text-secondary-text">{plan.tagline}</p>
              </div>

              <div className="mt-5 flex items-baseline gap-2">
                <span
                  className={cn(
                    "font-display text-3xl font-semibold",
                    plan.highlight ? "gold-gradient-text" : "text-foreground",
                  )}
                >
                  {plan.priceLabel}
                </span>
                <span className="text-xs text-secondary-text">{plan.priceNote}</span>
              </div>

              <ul className="mt-6 flex flex-1 flex-col gap-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <CheckIcon size={12} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                className={cn(
                  "mt-7 w-full",
                  plan.highlight
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border-border bg-surface text-foreground hover:bg-raised",
                  plan.highlight ? "" : "border",
                )}
                variant={plan.highlight ? "default" : "outline"}
                onClick={() =>
                  openWaitlist(plan.id === "creator-pro" ? "creator" : "general")
                }
              >
                <SparklesIcon size={16} className="mr-1.5" />
                {plan.cta}
              </Button>
            </motion.article>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-secondary-text">
          Prices, allowances and quotas are admin-configurable at runtime — never hardcoded
          in source.
        </p>
      </div>
    </section>
  );
}
