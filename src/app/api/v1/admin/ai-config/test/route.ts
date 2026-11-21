import { NextResponse } from "next/server";

import { requireRole, ROLES } from "@/lib/auth-helpers";
import { testNvidiaConnection } from "@/lib/ai/nvidia";

/** POST /api/v1/admin/ai-config/test — super-admin diagnostic. */
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireRole(ROLES.SUPER_ADMIN);
  if (!auth.ok) return auth.response;

  const result = await testNvidiaConnection();
  return NextResponse.json({ data: result });
}
