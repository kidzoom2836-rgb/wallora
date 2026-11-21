import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth-helpers";
import { generateSiteHtml, SITE_STAGES } from "@/lib/sites/generate";
import { createSite, listSites, updateSite, type SiteRecord } from "@/lib/sites/store";

export const dynamic = "force-dynamic";

/** GET /api/v1/sites — the signed-in user's sites. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const sites = await listSites(auth.session.user.id);
  return NextResponse.json({ data: { sites } });
}

/** POST /api/v1/sites — generate a site from a prompt, or edit an existing one. */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: { prompt?: string; instruction?: string; siteId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const siteId = typeof body.siteId === "string" ? body.siteId : "";
  if (!prompt && !siteId) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Describe the site you want to build." } },
      { status: 400 },
    );
  }

  let existing: SiteRecord | null = null;
  if (siteId) {
    const all = await listSites(auth.session.user.id);
    existing = all.find((s) => s.id === siteId) ?? null;
    if (!existing) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Site not found." } },
        { status: 404 },
      );
    }
  }

  try {
    const generated = await generateSiteHtml({
      prompt: prompt || existing?.prompt || "",
      currentHtml: existing?.html,
      instruction: body.instruction,
    });

    const site = existing
      ? await updateSite(existing.id, {
          html: generated.html,
          title: generated.title,
          prompt: prompt || existing.prompt,
          model: generated.model,
        })
      : await createSite({
          ownerId: auth.session.user.id,
          title: generated.title,
          prompt,
          html: generated.html,
          model: generated.model,
        });

    return NextResponse.json({
      data: { site, stages: SITE_STAGES, model: generated.model },
      message: existing ? "Site updated." : "Site built.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "generation_failed",
          message: err instanceof Error ? err.message : "Could not build the site.",
        },
      },
      { status: 500 },
    );
  }
}
