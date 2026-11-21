import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";

/**
 * POST /api/v1/wallpapers/[slug]/like   — like a wallpaper (auth required)
 * DELETE /api/v1/wallpapers/[slug]/like — remove a like (auth required)
 *
 * Both are idempotent. Counters are updated atomically in a transaction.
 */

async function getWallpaperId(slug: string) {
  const w = await db.wallpaper.findUnique({
    where: { slug },
    select: { id: true, status: true, isPublic: true },
  });
  if (!w || w.status !== "approved" || !w.isPublic) return null;
  return w.id;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const { slug } = await params;
  const wallpaperId = await getWallpaperId(slug);
  if (!wallpaperId) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Wallpaper not found." } },
      { status: 404 },
    );
  }

  const userId = result.session.user.id;

  const updated = await db.$transaction(async (tx) => {
    // Idempotent: create only if not already liked
    const existing = await tx.wallpaperLike.findUnique({
      where: { wallpaperId_userId: { wallpaperId, userId } },
      select: { id: true },
    });
    if (existing) {
      const w = await tx.wallpaper.findUnique({
        where: { id: wallpaperId },
        select: { likeCount: true },
      });
      return { liked: true, likeCount: w?.likeCount ?? 0 };
    }
    await tx.wallpaperLike.create({ data: { wallpaperId, userId } });
    const w = await tx.wallpaper.update({
      where: { id: wallpaperId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });
    return { liked: true, likeCount: w.likeCount };
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const { slug } = await params;
  const wallpaperId = await getWallpaperId(slug);
  if (!wallpaperId) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Wallpaper not found." } },
      { status: 404 },
    );
  }

  const userId = result.session.user.id;

  const updated = await db.$transaction(async (tx) => {
    const existing = await tx.wallpaperLike.findUnique({
      where: { wallpaperId_userId: { wallpaperId, userId } },
      select: { id: true },
    });
    if (!existing) {
      const w = await tx.wallpaper.findUnique({
        where: { id: wallpaperId },
        select: { likeCount: true },
      });
      return { liked: false, likeCount: w?.likeCount ?? 0 };
    }
    await tx.wallpaperLike.delete({ where: { id: existing.id } });
    const w = await tx.wallpaper.update({
      where: { id: wallpaperId },
      data: { likeCount: { decrement: 1 } },
      select: { likeCount: true },
    });
    return { liked: false, likeCount: Math.max(0, w.likeCount) };
  });

  return NextResponse.json({ data: updated });
}
