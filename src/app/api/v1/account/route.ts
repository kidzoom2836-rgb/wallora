import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth-helpers";
import { clearPushTokensForUser } from "@/lib/push/store";

/**
 * DELETE /api/v1/account
 *
 * Self-service account deletion. Soft-deletes the account using the existing
 * User.status field (no schema change) and removes sensitive profile fields.
 * Wallpaper/content records are retained for community integrity, but the
 * account can no longer sign in and is excluded from public profiles/search.
 */
export async function DELETE(_request: NextRequest) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in required." } },
      { status: 401 },
    );
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === "super_admin") {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Super admin accounts cannot be deleted here." } },
      { status: 403 },
    );
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { status: "deleted" },
    });
    await tx.profile.updateMany({
      where: { userId },
      data: { displayName: "Deleted user", bio: null, avatarUrl: null, coverUrl: null },
    });
  });

  await clearPushTokensForUser(userId).catch(() => {});

  return NextResponse.json({ data: { deleted: true } });
}
