import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth-helpers";
import { getSite, updateSite, isPro } from "@/lib/sites/store";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/sites/[id]/publish
 * Body: { published?: boolean, external?: boolean, forSale?: boolean, priceCents?: number }
 *
 * `published` makes the site visible at /sites/<slug> inside WALLORA.
 * `external` additionally exposes a direct link — a Pro capability.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const site = await getSite(id);
  if (!site || site.ownerId !== auth.session.user.id) {
    return NextResponse.json({ error: { code: "not_found", message: "Site not found." } }, { status: 404 });
  }

  let body: { published?: boolean; external?: boolean; forSale?: boolean; priceCents?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON." } }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.published === "boolean") patch.published = body.published;
  if (typeof body.forSale === "boolean") patch.forSale = body.forSale;
  if (typeof body.priceCents === "number") {
    patch.priceCents = Math.max(0, Math.min(1000000, Math.round(body.priceCents)));
  }
  if (typeof body.external === "boolean") {
    if (body.external && !(await isPro(auth.session.user.id, auth.session.user.role))) {
      return NextResponse.json(
        {
          error: {
            code: "pro_required",
            message: "Direct external links are a WALLORA Pro feature. Your site is still published inside WALLORA.",
          },
        },
        { status: 403 },
      );
    }
    patch.externalPublished = body.external;
    if (body.external) patch.published = true;
  }

  const updated = await updateSite(id, patch);
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  return NextResponse.json({
    data: {
      site: updated,
      internalUrl: `/sites/${site.slug}`,
      externalUrl: updated?.externalPublished ? `${base}/sites/${site.slug}` : null,
    },
  });
}
