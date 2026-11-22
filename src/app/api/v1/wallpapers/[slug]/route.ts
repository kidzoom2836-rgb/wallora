import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth-helpers";
import { getTier } from "@/lib/verification/store";
import { groupVariationAssets } from "@/lib/wallpaper-variants";
import {
  readVariationMetadata,
  readVariationMetadataMany,
} from "@/lib/variation-metadata";

/**
 * GET /api/v1/wallpapers/[slug]
 * Returns full wallpaper detail: all assets, tags, creator, related.
 * Increments viewCount atomically (fire-and-forget).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const session = await getAuthSession();
  const userId = session?.user?.id;

  const wallpaper = await db.wallpaper.findUnique({
    where: { slug },
    include: {
      category: true,
      user: {
        select: {
          id: true,
          profile: { select: { username: true, displayName: true, bio: true, verified: true, avatarUrl: true } },
        },
      },
      assets: {
        orderBy: { variant: "asc" },
        select: { id: true, variant: true, objectKey: true, width: true, height: true, fileSize: true, format: true, mimeType: true },
      },
      tags: { select: { tag: { select: { slug: true, name: true } } } },
      ...(userId
        ? {
            likes: { where: { userId }, select: { id: true } },
            favorites: { where: { userId }, select: { id: true } },
          }
        : {}),
    },
  });

  if (!wallpaper || wallpaper.status !== "approved" || !wallpaper.isPublic) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Wallpaper not found or not available." } },
      { status: 404 },
    );
  }

  // Increment view count (best-effort, non-blocking)
  db.wallpaper
    .update({ where: { id: wallpaper.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  // Related wallpapers (same category, excluding this one)
  const related = wallpaper.categoryId
    ? await db.wallpaper.findMany({
        where: {
          categoryId: wallpaper.categoryId,
          id: { not: wallpaper.id },
          status: "approved",
          isPublic: true,
        },
        take: 6,
        orderBy: { likeCount: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          orientation: true,
          dominantColor: true,
          likeCount: true,
          assets: {
            select: { variant: true, objectKey: true, width: true, height: true },
            orderBy: { variant: "asc" },
          },
        },
      })
    : [];

  const [tier, variationMeta, relatedMeta] = await Promise.all([
    getTier(wallpaper.user.id),
    readVariationMetadata(wallpaper.id),
    readVariationMetadataMany(related.map((r) => r.id)),
  ]);

  const groups = groupVariationAssets(wallpaper.assets, variationMeta);

  return NextResponse.json({
    data: {
      id: wallpaper.id,
      slug: wallpaper.slug,
      title: wallpaper.title,
      description: wallpaper.description,
      orientation: wallpaper.orientation,
      dominantColor: wallpaper.dominantColor,
      license: wallpaper.license,
      sourceType: wallpaper.sourceType,
      likeCount: wallpaper.likeCount,
      favoriteCount: wallpaper.favoriteCount,
      downloadCount: wallpaper.downloadCount,
      viewCount: wallpaper.viewCount + 1, // reflect this view
      createdAt: wallpaper.createdAt,
      category: wallpaper.category
        ? { slug: wallpaper.category.slug, name: wallpaper.category.name }
        : null,
      creator: {
        id: wallpaper.user.id,
        username: wallpaper.user.profile?.username ?? null,
        displayName: wallpaper.user.profile?.displayName ?? null,
        bio: wallpaper.user.profile?.bio ?? null,
        verified: wallpaper.user.profile?.verified ?? false,
        avatarUrl: wallpaper.user.profile?.avatarUrl ?? null,
        tier,
      },
      assets: wallpaper.assets,
      // Additive: one gallery entry per source image, in submission order.
      variationCount: groups.length,
      variations: groups.map((group) => ({
        index: group.index,
        label: group.label,
        prefix: group.prefix,
        previewAsset: group.preview,
        originalAsset: group.original,
        gridAsset: group.grid,
        detailAsset: group.detail,
        assets: group.assets,
      })),
      tags: wallpaper.tags.map((t) => t.tag),
      liked: userId ? wallpaper.likes?.length > 0 : false,
      favorited: userId ? wallpaper.favorites?.length > 0 : false,
      related: related.map((r) => {
        const relatedGroups = groupVariationAssets(r.assets, relatedMeta[r.id]);
        const base = relatedGroups[0];
        return {
          id: r.id,
          slug: r.slug,
          title: r.title,
          orientation: r.orientation,
          dominantColor: r.dominantColor,
          likeCount: r.likeCount,
          asset: base?.preview ?? r.assets[0] ?? null,
          variationCount: relatedGroups.length,
          variations: relatedGroups.map((group) => ({
            index: group.index,
            label: group.label,
            preview: group.preview,
          })),
        };
      }),
    },
  });
}
