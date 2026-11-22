import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireRole, ROLES } from "@/lib/auth-helpers";
import { getTiersForUsers, TIER_RANK } from "@/lib/verification/store";

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

  const stale = await db.wallpaper.findMany({
    where: {
      status: "approved",
      isPublic: false,
      sourceType: "upload",
    },
    select: { id: true, userId: true },
  });

  // Publishing is a verification-gated action. Free grey-tier accounts count
  // as verified, so this preserves the old repair behaviour while preventing
  // an unverified account from being made public by a maintenance script.
  const tiers = await getTiersForUsers(stale.map((w) => w.userId));
  const eligibleIds = stale
    .filter((w) => TIER_RANK[tiers[w.userId] ?? "free"] >= TIER_RANK.free)
    .map((w) => w.id);

  const result = eligibleIds.length
    ? await db.wallpaper.updateMany({
        where: { id: { in: eligibleIds } },
        data: { isPublic: true },
      })
    : { count: 0 };

  await db.auditLog.create({
    data: {
      actorId: auth.session.user.id,
      action: "maintenance.repair_uploads",
      targetType: "wallpaper",
      targetId: "bulk",
      metadata: JSON.stringify({
        repaired: result.count,
        scanned: stale.length,
        skippedUnverified: stale.length - result.count,
      }),
    },
  });

  return NextResponse.json({
    data: {
      repaired: result.count,
      scanned: stale.length,
      skippedUnverified: stale.length - result.count,
    },
  });
}
