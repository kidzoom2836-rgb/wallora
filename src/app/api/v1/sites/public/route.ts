import { NextResponse } from "next/server";

import { listPublishedSites } from "@/lib/sites/store";

export const dynamic = "force-dynamic";

/** GET /api/v1/sites/public — showcase of sites published inside WALLORA. */
export async function GET() {
  const sites = await listPublishedSites();
  return NextResponse.json({
    data: {
      sites: sites.map((s) => ({
        id: s.id,
        slug: s.slug,
        title: s.title,
        prompt: s.prompt.slice(0, 180),
        forSale: s.forSale,
        priceCents: s.priceCents,
        createdAt: s.createdAt,
      })),
    },
  });
}
