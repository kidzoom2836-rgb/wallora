import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getTiersForUsers } from "@/lib/verification/store";

/**
 * GET /api/v1/users/search?q=@handle|name
 *
 * Public creator/people search for Discover. Accepts an optional leading "@"
 * and matches username or display name case-insensitively. Only active
 * accounts with a profile are returned. Never exposes email or private fields.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("q")?.trim() ?? "";
  const q = raw.replace(/^@+/, "").trim();
  const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") ?? "8", 10) || 8));

  if (q.length < 2) {
    return NextResponse.json({ data: [] });
  }

  const profiles = await db.profile.findMany({
    where: {
      user: { status: "active" },
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
      ],
    },
    take: limit,
    select: {
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      verified: true,
      userId: true,
      user: {
        select: {
          _count: {
            select: {
              wallpapers: { where: { status: "approved", isPublic: true } },
              followers: true,
            },
          },
        },
      },
    },
    orderBy: { username: "asc" },
  });

  const tiers = await getTiersForUsers(profiles.map((p) => p.userId));

  return NextResponse.json({
    data: profiles.map((p) => ({
      id: p.userId,
      username: p.username,
      displayName: p.displayName,
      bio: p.bio,
      avatarUrl: p.avatarUrl,
      verified: p.verified,
      tier: tiers[p.userId] ?? "free",
      wallpaperCount: p.user._count.wallpapers,
      followerCount: p.user._count.followers,
    })),
  });
}
