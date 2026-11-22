import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { createRequest, getMyRequest, getTier, hasClaimed } from "@/lib/verification/store";

export const dynamic = "force-dynamic";

/** GET /api/v1/verification — the signed-in user's application and tier. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const [request, tier, claimed] = await Promise.all([
    getMyRequest(auth.session.user.id),
    getTier(auth.session.user.id),
    hasClaimed(auth.session.user.id),
  ]);
  return NextResponse.json({ data: { request, tier, claimed } });
}

/** POST /api/v1/verification — apply for Verified or Premium. */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: { tier?: string; reason?: string; portfolio?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON." } }, { status: 400 });
  }

  const tier = body.tier === "premium" ? "premium" : "verified";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const portfolio = typeof body.portfolio === "string" ? body.portfolio.trim() : "";
  if (reason.length < 20) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Tell us why you should be verified (at least 20 characters)." } },
      { status: 400 },
    );
  }
  if (portfolio.length < 8) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Add a link or examples of your work." } },
      { status: 400 },
    );
  }

  const user = await db.user.findUnique({
    where: { id: auth.session.user.id },
    select: { email: true, profile: { select: { username: true, displayName: true } } },
  });

  try {
    const created = await createRequest({
      userId: auth.session.user.id,
      tier,
      reason,
      portfolio,
      email: user?.email ?? null,
      username: user?.profile?.username ?? null,
      displayName: user?.profile?.displayName ?? null,
    });
    return NextResponse.json({ data: { request: created }, message: "Application submitted." }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "conflict", message: err instanceof Error ? err.message : "Could not submit." } },
      { status: 409 },
    );
  }
}
