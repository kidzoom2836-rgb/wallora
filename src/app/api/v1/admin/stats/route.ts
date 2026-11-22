import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireRole, ROLES } from "@/lib/auth-helpers";

/**
 * GET /api/v1/admin/stats
 *
 * Returns REAL aggregate platform metrics from the database — no synthetic
 * numbers. Aggregated in parallel. Super admin only.
 */
export async function GET() {
  const auth = await requireRole(ROLES.SUPER_ADMIN);
  if (!auth.ok) return auth.response;

  // Start of "today" in UTC — used for all "today" counters.
  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  // Counters + today aggregates run concurrently.
  const [
    totalUsers,
    totalWallpapers,
    pendingWallpapers,
    totalConversations,
    totalMessages,
    totalGenerations,
    totalComments,
    totalProducts,
    totalPurchases,
    totalWaitlistEntries,
    todayNewUsers,
    todayNewWallpapers,
    todayAiUsageAgg,
    approvedCount,
    rejectedCount,
    flaggedCount,
    topCategories,
  ] = await Promise.all([
    db.user.count(),
    db.wallpaper.count(),
    db.wallpaper.count({ where: { status: "pending" } }),
    db.aiConversation.count(),
    db.aiMessage.count(),
    db.aiGeneration.count(),
    db.comment.count(),
    db.product.count(),
    db.purchase.count(),
    db.waitlistEntry.count(),
    db.user.count({ where: { createdAt: { gte: startOfToday } } }),
    db.wallpaper.count({ where: { createdAt: { gte: startOfToday } } }),
    db.usageLedger.aggregate({
      where: { createdAt: { gte: startOfToday } },
      _sum: { creditsUsed: true },
    }),
    db.wallpaper.count({ where: { status: "approved" } }),
    db.wallpaper.count({ where: { status: "rejected" } }),
    db.wallpaper.count({ where: { status: "flagged" } }),
    db.category.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        icon: true,
        _count: { select: { wallpapers: true } },
      },
      orderBy: { wallpapers: { _count: "desc" } },
      take: 5,
    }),
  ]);

  return NextResponse.json({
    data: {
      totalUsers,
      totalWallpapers,
      pendingWallpapers,
      totalConversations,
      totalMessages,
      totalGenerations,
      totalComments,
      totalProducts,
      totalPurchases,
      totalWaitlistEntries,
      todayAiUsage: todayAiUsageAgg._sum.creditsUsed ?? 0,
      todayNewUsers,
      todayNewWallpapers,
      wallpapersByStatus: {
        approved: approvedCount,
        pending: pendingWallpapers,
        rejected: rejectedCount,
        flagged: flaggedCount,
      },
      topCategories: topCategories.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        icon: c.icon ?? null,
        wallpaperCount: c._count.wallpapers,
      })),
    },
  });
}
