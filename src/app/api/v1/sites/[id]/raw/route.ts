import { NextResponse } from "next/server";

import { getSite } from "@/lib/sites/store";

export const dynamic = "force-dynamic";

/** GET /api/v1/sites/[id]/raw — raw HTML for the sandboxed preview iframe. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await getSite(id);
  if (!site) {
    return NextResponse.json({ error: { code: "not_found", message: "Site not found." } }, { status: 404 });
  }
  return new NextResponse(site.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
