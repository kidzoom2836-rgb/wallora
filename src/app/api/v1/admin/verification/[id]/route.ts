import { NextRequest, NextResponse } from "next/server";

import { requireRole, ROLES } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { reviewRequest } from "@/lib/verification/store";

export const dynamic = "force-dynamic";

/** POST /api/v1/admin/verification/[id] — approve or reject an application. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(ROLES.SUPER_ADMIN);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: { decision?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON." } }, { status: 400 });
  }
  if (body.decision !== "approved" && body.decision !== "rejected") {
    return NextResponse.json(
      { error: { code: "bad_request", message: "decision must be approved or rejected." } },
      { status: 400 },
    );
  }

  const updated = await reviewRequest(
    id,
    body.decision,
    auth.session.user.id,
    typeof body.note === "string" ? body.note.slice(0, 500) : null,
  );
  if (!updated) {
    return NextResponse.json({ error: { code: "not_found", message: "Request not found." } }, { status: 404 });
  }

  await db.auditLog.create({
    data: {
      actorId: auth.session.user.id,
      action: `verification.${body.decision}`,
      targetType: "user",
      targetId: updated.userId,
      metadata: JSON.stringify({ tier: updated.tier, requestId: id, note: body.note ?? null }),
    },
  });

  return NextResponse.json({ data: { request: updated } });
}
