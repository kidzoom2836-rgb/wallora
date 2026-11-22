import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth-helpers";
import { getTier, hasClaimed } from "@/lib/verification/store";

export const dynamic = "force-dynamic";

/** GET /api/v1/verification/state — tier + whether the explainer was seen. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const [tier, claimed] = await Promise.all([
    getTier(auth.session.user.id),
    hasClaimed(auth.session.user.id),
  ]);
  return NextResponse.json({ data: { tier, claimed } });
}
