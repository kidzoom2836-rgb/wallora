"use client";

import Link from "next/link";
import { LayoutGrid, Plus, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MarketplaceGrid } from "@/components/landing/marketplace-grid";

export default function MarketplacePage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="relative overflow-hidden border-b border-border bg-surface">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(215,184,121,0.12),transparent_55%)]" />
        <div className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-4 py-8 sm:px-6 lg:px-8">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
              WALLORA Marketplace
            </p>
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
              Sell your work. Own what you love.
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-secondary-text">
              Creators publish real listings with clear licenses. Purchases record real
              entitlements in your library — no payment gateway is connected in this demo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="border-border" asChild>
              <Link href="/showroom"><LayoutGrid className="size-4" /> Showroom</Link>
            </Button>
            <Button variant="outline" className="border-border" asChild>
              <Link href="/marketplace/manage"><Store className="size-4" /> My listings</Link>
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
              <Link href="/marketplace/new"><Plus className="size-4" /> New listing</Link>
            </Button>
          </div>
        </div>
      </div>

      <MarketplaceGrid showHeading={false} />
    </div>
  );
}
