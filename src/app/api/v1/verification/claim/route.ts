import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth-helpers";
import { claimVerification, getTier } from "@/lib/verification/store";

export const dynamic = "force-dynamic";

/** POST /api/v1/verification/claim — acknowledge the explainer, grant free tier. */
export async function POST() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  await claimVerification(auth.session.user.id);
  return NextResponse.json({ data: { tier: await getTier(auth.session.user.id), claimed: true } });
}
