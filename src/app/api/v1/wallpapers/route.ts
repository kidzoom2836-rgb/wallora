import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth-helpers";
import { getTiersForUsers } from "@/lib/verification/store";

/**
 * GET /api/v1/wallpapers
 *
 * Query params:
 *   q          — search title + description
 *   category   — category slug filter
 *   tag        — tag slug filter
 *   creator    — creator username filter
 *   orientation — portrait | landscape | square
 *   sort       — newest | popular | downloads | likes (default: newest)
 *   page       — 1-based page (default 1)
 *   limit      — items per page (default 12, max 24)
 *
 * Returns paginated wallpaper summaries with the current user's liked /
 * favorited status (if authenticated).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const category = searchParams.get("category")?.trim() ?? "";
  const tag = searchParams.get("tag")?.trim() ?? "";
  const creator = searchParams.get("creator")?.trim() ?? "";
  const orientation = searchParams.get("orientation")?.trim() ?? "";
  const sort = searchParams.get("sort")?.trim() ?? "newest";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(24, Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10) || 12));

  const session = await getAuthSession();
  const userId = session?.user?.id;

  // Build the where clause
  const where: Record<string, unknown> = {
    status: "approved",
    isPublic: true,
  };

  if (q) {
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
    ];
  }
  if (orientation && ["portrait", "landscape", "square"].includes(orientation)) {
    where.orientation = orientation;
  }
  if (category) {
    where.category = { slug: category };
  }
  if (tag) {
    where.tags = { some: { tag: { slug: tag } } };
  }
  if (creator) {
    where.user = { profile: { username: creator } };
  }

  // Sort
  const orderBy: Record<string, "asc" | "desc"> = {};
  if (sort === "popular") orderBy.likeCount = "desc";
  else if (sort === "downloads") orderBy.downloadCount = "desc";
  else if (sort === "likes") orderBy.likeCount = "desc";
  else orderBy.createdAt = "desc";

  const [total, items] = await Promise.all([
    db.wallpaper.count({ where: where as never }),
    db.wallpaper.findMany({
      where: where as never,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        orientation: true,
        dominantColor: true,
        license: true,
        sourceType: true,
        likeCount: true,
        favoriteCount: true,
        downloadCount: true,
        viewCount: true,
        createdAt: true,
        category: { select: { slug: true, name: true } },
        user: {
          select: {
            id: true,
            profile: { select: { username: true, displayName: true, verified: true } },
          },
        },
        assets: {
          where: { variant: { in: ["grid", "original"] } },
          select: { variant: true, objectKey: true, width: true, height: true },
          orderBy: { variant: "asc" },
        },
        tags: {
          select: { tag: { select: { slug: true, name: true } } },
          take: 6,
        },
        ...(userId
          ? {
              likes: { where: { userId }, select: { id: true } },
              favorites: { where: { userId }, select: { id: true } },
            }
          : {}),
      },
    }),
  ]);

  const tiers = await getTiersForUsers(items.map((w) => w.user.id));

  const data = items.map((w) => {
    const gridAsset = w.assets.find((a) => a.variant === "grid") ?? w.assets[0];
    return {
      id: w.id,
      slug: w.slug,
      title: w.title,
      description: w.description,
      orientation: w.orientation,
      dominantColor: w.dominantColor,
      license: w.license,
      sourceType: w.sourceType,
      likeCount: w.likeCount,
      favoriteCount: w.favoriteCount,
      downloadCount: w.downloadCount,
      viewCount: w.viewCount,
      createdAt: w.createdAt,
      category: w.category,
      creator: {
        id: w.user.id,
        username: w.user.profile?.username ?? null,
        displayName: w.user.profile?.displayName ?? null,
        verified: w.user.profile?.verified ?? false,
        tier: tiers[w.user.id] ?? "free",
      },
      asset: gridAsset
        ? {
            objectKey: gridAsset.objectKey,
            width: gridAsset.width,
            height: gridAsset.height,
          }
        : null,
      tags: w.tags.map((t) => t.tag),
      liked: userId ? w.likes?.length > 0 : false,
      favorited: userId ? w.favorites?.length > 0 : false,
    };
  });

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
