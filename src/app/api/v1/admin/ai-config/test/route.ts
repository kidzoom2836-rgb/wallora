import { NextRequest, NextResponse } from "next/server";

import { requireRole, ROLES } from "@/lib/auth-helpers";
import { testNvidiaConnection } from "@/lib/ai/nvidia";

/** POST /api/v1/admin/ai-config/test — super-admin diagnostic. */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireRole(ROLES.SUPER_ADMIN);
  if (!auth.ok) return auth.response;

  let model: string | undefined;
  try {
    const body = await request.json();
    if (body && typeof body === "object" && typeof body.model === "string") {
      model = body.model;
    }
  } catch {
    /* empty body is valid — test the saved model */
  }

  const result = await testNvidiaConnection(model);
  return NextResponse.json({ data: result });
}
