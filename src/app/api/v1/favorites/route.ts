import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";

/**
 * GET /api/v1/favorites
 * Returns the authenticated user's saved wallpapers (favorites).
 */
export async function GET(request: NextRequest) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const userId = result.session.user.id;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(24, Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10) || 12));

  const [total, favorites] = await Promise.all([
    db.favorite.count({ where: { userId } }),
    db.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        createdAt: true,
        wallpaper: {
          select: {
            id: true,
            slug: true,
            title: true,
            orientation: true,
            dominantColor: true,
            likeCount: true,
            favoriteCount: true,
            downloadCount: true,
            createdAt: true,
            category: { select: { slug: true, name: true } },
            user: {
              select: {
                profile: { select: { username: true, displayName: true, verified: true } },
              },
            },
            assets: {
              where: { variant: "grid" },
              select: { objectKey: true, width: true, height: true },
              take: 1,
            },
            tags: { select: { tag: { select: { slug: true, name: true } } }, take: 4 },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    data: {
      items: favorites.map((f) => ({
        favoritedAt: f.createdAt,
        wallpaper: {
          id: f.wallpaper.id,
          slug: f.wallpaper.slug,
          title: f.wallpaper.title,
          orientation: f.wallpaper.orientation,
          dominantColor: f.wallpaper.dominantColor,
          likeCount: f.wallpaper.likeCount,
          favoriteCount: f.wallpaper.favoriteCount,
          downloadCount: f.wallpaper.downloadCount,
          createdAt: f.wallpaper.createdAt,
          category: f.wallpaper.category,
          creator: {
            username: f.wallpaper.user.profile?.username ?? null,
            displayName: f.wallpaper.user.profile?.displayName ?? null,
            verified: f.wallpaper.user.profile?.verified ?? false,
          },
          asset: f.wallpaper.assets[0] ?? null,
          tags: f.wallpaper.tags.map((t) => t.tag),
          favorited: true,
          liked: false, // not checked here for performance
        },
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
