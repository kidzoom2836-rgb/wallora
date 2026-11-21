import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireRole, ROLES } from "@/lib/auth-helpers";

/**
 * GET /api/v1/admin/users
 *
 * Paginated list of all users with profile info, role, status, and
 * engagement counters (wallpapers, conversations). Sorted by createdAt desc.
 *
 * Query params:
 *   page  — 1-based page (default 1)
 *   limit — items per page (default 50, hard max 50)
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(ROLES.MODERATOR);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));

  const [total, items] = await Promise.all([
    db.user.count(),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        status: true,
        createdAt: true,
        profile: {
          select: {
            username: true,
            displayName: true,
            verified: true,
            creatorStatus: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            wallpapers: true,
            conversations: true,
          },
        },
      },
    }),
  ]);

  const data = items.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    image: u.image,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    profile: u.profile
      ? {
          username: u.profile.username,
          displayName: u.profile.displayName,
          verified: u.profile.verified,
          creatorStatus: u.profile.creatorStatus,
          avatarUrl: u.profile.avatarUrl,
        }
      : null,
    wallpaperCount: u._count.wallpapers,
    conversationCount: u._count.conversations,
  }));

  return NextResponse.json({
    data: {
      items: data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    },
  });
}
