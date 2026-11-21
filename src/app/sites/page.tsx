"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowUpRight, Globe, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type PublicSite = {
  id: string;
  slug: string;
  title: string;
  prompt: string;
  forSale: boolean;
  priceCents: number;
  createdAt: string;
};

export default function SitesExplorePage() {
  const query = useQuery<{ data: { sites: PublicSite[] } }>({
    queryKey: ["public-sites"],
    queryFn: () => fetch("/api/v1/sites/public").then((r) => r.json()),
  });

  const sites = query.data?.data.sites ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">WALLORA Builder</p>
          <h1 className="mt-2 font-display text-3xl font-bold">Sites built on WALLORA</h1>
          <p className="mt-2 max-w-xl text-sm text-secondary-text">
            Real projects made in the Builder and published inside WALLORA. Open one to see the full working site.
          </p>
        </div>
        <Button asChild>
          <Link href="/builder">Build your own</Link>
        </Button>
      </div>

      {query.isLoading && <p className="mt-10 text-sm text-secondary-text">Loading sites…</p>}
      {query.isError && <p className="mt-10 text-sm text-destructive">Could not load sites.</p>}
      {!query.isLoading && sites.length === 0 && (
        <div className="mt-10 rounded-2xl border border-border bg-surface p-10 text-center">
          <Globe className="mx-auto size-10 text-primary/40" />
          <p className="mt-3 text-sm text-secondary-text">
            No published sites yet. Be the first to build and publish one.
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sites.map((site) => (
          <Link
            key={site.id}
            href={`/sites/${site.slug}`}
            target="_blank"
            className="group rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Globe className="size-5" />
              </span>
              <ArrowUpRight className="size-4 text-secondary-text transition-colors group-hover:text-primary" />
            </div>
            <h2 className="mt-4 truncate font-display text-base font-semibold">{site.title}</h2>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-secondary-text">{site.prompt}</p>
            <div className="mt-4 flex items-center gap-2">
              {site.forSale ? (
                <Badge variant="default" className="gap-1">
                  <ShoppingBag className="size-3" />
                  ${(site.priceCents / 100).toFixed(0)}
                </Badge>
              ) : (
                <Badge variant="secondary">Free to view</Badge>
              )}
              <span className="text-[11px] text-secondary-text">
                {new Date(site.createdAt).toLocaleDateString()}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
