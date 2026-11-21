import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth-helpers";

/**
 * GET /api/v1/users/[username]
 *
 * Returns the public profile of a WALLORA creator by username, including:
 *   - profile fields (displayName, bio, avatarUrl, verified, creatorStatus)
 *   - follower + following counts
 *   - wallpaper count (approved + public only)
 *   - whether the current viewer (if authenticated) is following them
 *
 * Comments / follows of the user themselves are intentionally not exposed.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const session = await getAuthSession();
  const viewerId = session?.user?.id ?? null;

  const profile = await db.profile.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      coverUrl: true,
      verified: true,
      creatorStatus: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          status: true,
          _count: {
            select: {
              following: true, // people this user follows
              followers: true, // people following this user
              wallpapers: {
                where: {
                  status: "approved",
                  isPublic: true,
                },
              },
            },
          },
          ...(viewerId
            ? {
                followers: {
                  where: { followerId: viewerId },
                  select: { id: true },
                  take: 1,
                },
              }
            : {}),
        },
      },
    },
  });

  if (!profile || !profile.user || profile.user.status !== "active") {
    return NextResponse.json(
      { error: { code: "not_found", message: "User not found." } },
      { status: 404 },
    );
  }

  const isFollowing = viewerId ? profile.user.followers?.length > 0 : false;
  const isSelf = viewerId === profile.user.id;

  return NextResponse.json({
    data: {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      coverUrl: profile.coverUrl,
      verified: profile.verified,
      creatorStatus: profile.creatorStatus,
      createdAt: profile.createdAt,
      stats: {
        followers: profile.user._count.followers,
        following: profile.user._count.following,
        wallpapers: profile.user._count.wallpapers,
      },
      isFollowing,
      isSelf,
    },
  });
}
