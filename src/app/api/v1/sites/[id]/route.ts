import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth-helpers";
import { deleteSite, getSite, listSites, updateSite } from "@/lib/sites/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function owned(id: string, userId: string) {
  const site = await getSite(id);
  return site && site.ownerId === userId ? site : null;
}

/** PATCH /api/v1/sites/[id] — save manual code edits / metadata. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!(await owned(id, auth.session.user.id))) {
    return NextResponse.json({ error: { code: "not_found", message: "Site not found." } }, { status: 404 });
  }

  let body: { html?: string; title?: string; forSale?: boolean; priceCents?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON." } }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.html === "string") patch.html = body.html.slice(0, 500000);
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 120);
  if (typeof body.forSale === "boolean") patch.forSale = body.forSale;
  if (typeof body.priceCents === "number" && Number.isFinite(body.priceCents)) {
    patch.priceCents = Math.max(0, Math.min(1000000, Math.round(body.priceCents)));
  }

  const site = await updateSite(id, patch);
  return NextResponse.json({ data: { site } });
}

/** DELETE /api/v1/sites/[id] */
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const site = await owned(id, auth.session.user.id);
  if (!site) {
    return NextResponse.json({ error: { code: "not_found", message: "Site not found." } }, { status: 404 });
  }
  await deleteSite(id);
  return NextResponse.json({ data: { deleted: true } });
}

/** GET /api/v1/sites/[id] */
export async function GET(_request: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const site = await owned(id, auth.session.user.id);
  if (!site) {
    return NextResponse.json({ error: { code: "not_found", message: "Site not found." } }, { status: 404 });
  }
  return NextResponse.json({ data: { site } });
}
