import { NextResponse } from "next/server";

import { requireRole, ROLES } from "@/lib/auth-helpers";
import { getRequests } from "@/lib/verification/store";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/verification — review queue. */
export async function GET() {
  const auth = await requireRole(ROLES.SUPER_ADMIN);
  if (!auth.ok) return auth.response;
  const requests = await getRequests();
  return NextResponse.json({ data: { requests } });
}
