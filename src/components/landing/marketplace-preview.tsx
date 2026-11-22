"use client";

import { motion } from "framer-motion";
import {
  Store,
  Package,
  BadgeCheck,
  Wallet,
  ShieldCheck,
  ReceiptText,
  Sparkles,
} from "lucide-react";

import { SectionHeading } from "./section-heading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWaitlistDialog } from "@/stores/waitlist";

const PILLARS = [
  {
    icon: Package,
    title: "Digital wallpaper packs",
    description: "Sell curated packs and premium artwork with clear licenses.",
  },
  {
    icon: Store,
    title: "Creator storefronts",
    description: "A dedicated storefront for every verified creator.",
  },
  {
    icon: BadgeCheck,
    title: "Verified entitlements",
    description: "Server-side entitlements, never frontend state.",
  },
  {
    icon: Wallet,
    title: "Creator earnings ledger",
    description: "Real ledger with payout verification — no fabricated earnings.",
  },
  {
    icon: ReceiptText,
    title: "Idempotent payments",
    description: "Verified webhooks and duplicate-safe transactions.",
  },
  {
    icon: ShieldCheck,
    title: "Refund handling",
    description: "Grace periods, renewals and refund reconciliation built in.",
  },
];

export function MarketplacePreview() {
  const openWaitlist = useWaitlistDialog((s) => s.openWith);

  return (
    <section
      id="marketplace"
      className="relative border-y border-border bg-surface/40 py-20 sm:py-28"
      aria-labelledby="marketplace-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <SectionHeading
              eyebrow="Creator marketplace"
              title={<>Turn your creations into a livelihood</>}
              subtitle="WALLORA gives creators a real storefront, verified entitlements and an auditable earnings ledger. The marketplace is engineered honestly from day one — no fake sales, no fabricated activity."
            />
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold-glow"
                onClick={() => openWaitlist("creator")}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Join as a creator
              </Button>
              <Badge variant="outline" className="border-border bg-surface text-secondary-text">
                Open in Marketplace
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {PILLARS.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <motion.div
                  key={pillar.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: idx * 0.05 }}
                  className="rounded-xl border border-border bg-raised/60 p-4"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">
                    {pillar.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-secondary-text">
                    {pillar.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
