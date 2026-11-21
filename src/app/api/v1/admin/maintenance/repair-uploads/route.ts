import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireRole, ROLES } from "@/lib/auth-helpers";

/**
 * POST /api/v1/admin/maintenance/repair-uploads
 *
 * One-time data repair. Older approvals only flipped `status` and left
 * `isPublic: false`, so approved uploads stayed invisible in Discover.
 * Safe to run repeatedly — it only touches rows in the inconsistent state.
 */
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireRole(ROLES.SUPER_ADMIN);
  if (!auth.ok) return auth.response;

  const result = await db.wallpaper.updateMany({
    where: {
      status: "approved",
      isPublic: false,
      sourceType: "upload",
    },
    data: { isPublic: true },
  });

  await db.auditLog.create({
    data: {
      actorId: auth.session.user.id,
      action: "maintenance.repair_uploads",
      targetType: "wallpaper",
      targetId: "bulk",
      metadata: JSON.stringify({ repaired: result.count }),
    },
  });

  return NextResponse.json({ data: { repaired: result.count } });
}
