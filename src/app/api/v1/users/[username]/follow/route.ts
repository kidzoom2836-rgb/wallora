import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireVerification } from "@/lib/auth-helpers";

/**
 * POST   /api/v1/users/[username]/follow  — follow a user (auth required)
 * DELETE /api/v1/users/[username]/follow  — unfollow a user (auth required)
 *
 * Both are idempotent. Self-follow is rejected with a 400. The target user is
 * resolved by Profile.username (unique).
 */

async function resolveTargetUser(username: string) {
  // Username lookup is by Profile.username (unique). The register flow
  // normalizes usernames to lowercase, but the path param is treated as the
  // canonical username string.
  const profile = await db.profile.findUnique({
    where: { username },
    select: { userId: true },
  });
  return profile?.userId ?? null;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const result = await requireVerification();
  if (!result.ok) return result.response;

  const { username } = await params;
  const followerId = result.session.user.id;
  const followingId = await resolveTargetUser(username);

  if (!followingId) {
    return NextResponse.json(
      { error: { code: "not_found", message: "User not found." } },
      { status: 404 },
    );
  }

  if (followerId === followingId) {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "You cannot follow yourself." } },
      { status: 400 },
    );
  }

  // Idempotent: create only if not already following.
  const existing = await db.follow.findUnique({
    where: {
      followerId_followingId: { followerId, followingId },
    },
    select: { id: true },
  });

  if (!existing) {
    try {
      await db.follow.create({
        data: { followerId, followingId },
      });
    } catch {
      // Race-condition guard: another concurrent request may have created the
      // follow in the meantime. Treat that as success (idempotent).
    }
  }

  return NextResponse.json({ data: { following: true } });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const result = await requireVerification();
  if (!result.ok) return result.response;

  const { username } = await params;
  const followerId = result.session.user.id;
  const followingId = await resolveTargetUser(username);

  if (!followingId) {
    return NextResponse.json(
      { error: { code: "not_found", message: "User not found." } },
      { status: 404 },
    );
  }

  // Idempotent: delete only if it exists. No-op when not following.
  await db.follow.deleteMany({
    where: { followerId, followingId },
  });

  return NextResponse.json({ data: { following: false } });
}
