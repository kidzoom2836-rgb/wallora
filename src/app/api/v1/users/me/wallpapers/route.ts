import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";

/**
 * GET /api/v1/users/me/wallpapers
 *
 * Returns the authenticated user's uploaded wallpapers with moderation
 * status. Includes both pending and approved uploads so the user can see
 * their own content regardless of moderation state.
 *
 * Auth required.
 */
export async function GET(request: NextRequest) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const userId = result.session.user.id;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim(); // optional: pending|approved|rejected
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(24, Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10) || 12));

  const where: Record<string, unknown> = { userId };
  if (status) where.status = status;

  const [total, items] = await Promise.all([
    db.wallpaper.count({ where: where as never }),
    db.wallpaper.findMany({
      where: where as never,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        status: true,
        orientation: true,
        dominantColor: true,
        license: true,
        sourceType: true,
        isPublic: true,
        likeCount: true,
        favoriteCount: true,
        downloadCount: true,
        viewCount: true,
        createdAt: true,
        category: { select: { slug: true, name: true } },
        assets: {
          where: { variant: { in: ["grid", "detail", "original"] } },
          select: {
            variant: true,
            objectKey: true,
            width: true,
            height: true,
            fileSize: true,
            format: true,
          },
          orderBy: { variant: "asc" },
        },
        tags: { select: { tag: { select: { slug: true, name: true } } } },
        ...(userId
          ? {
              likes: { where: { userId }, select: { id: true } },
              favorites: { where: { userId }, select: { id: true } },
            }
          : {}),
      },
    }),
  ]);

  return NextResponse.json({
    data: {
      items: items.map((w) => ({
        id: w.id,
        slug: w.slug,
        title: w.title,
        description: w.description,
        status: w.status,
        orientation: w.orientation,
        dominantColor: w.dominantColor,
        license: w.license,
        sourceType: w.sourceType,
        isPublic: w.isPublic,
        likeCount: w.likeCount,
        favoriteCount: w.favoriteCount,
        downloadCount: w.downloadCount,
        viewCount: w.viewCount,
        createdAt: w.createdAt,
        category: w.category,
        assets: w.assets,
        tags: w.tags.map((t) => t.tag),
        liked: w.likes?.length > 0,
        favorited: w.favorites?.length > 0,
        gridAsset: w.assets.find((a) => a.variant === "grid") ?? w.assets[0] ?? null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    },
  });
}
