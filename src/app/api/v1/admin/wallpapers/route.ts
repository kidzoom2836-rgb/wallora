import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireRole, ROLES } from "@/lib/auth-helpers";
import { groupVariationAssets } from "@/lib/wallpaper-variants";
import { readVariationMetadataMany } from "@/lib/variation-metadata";

const STATUS_FILTERS = ["pending", "approved", "rejected", "flagged"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

/**
 * GET /api/v1/admin/wallpapers
 *
 * Paginated list of wallpapers for moderation review. Default filter is
 * `pending`. Each item includes creator info + the grid/original asset for
 * preview. Sorted by createdAt desc.
 *
 * Query params:
 *   status — pending|approved|rejected|flagged  (default: pending)
 *   page   — 1-based page (default 1)
 *   limit  — items per page (default 24, hard max 24)
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(ROLES.MODERATOR);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status")?.trim() ?? "pending";
  const status: StatusFilter | undefined = STATUS_FILTERS.includes(
    statusParam as StatusFilter,
  )
    ? (statusParam as StatusFilter)
    : undefined;

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(24, Math.max(1, parseInt(searchParams.get("limit") ?? "24", 10) || 24));

  // Filter by status if provided; otherwise list everything (excluding removed).
  const where: Record<string, unknown> = status
    ? { status }
    : { NOT: { status: "removed" } };

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
        license: true,
        orientation: true,
        dominantColor: true,
        sourceType: true,
        isPublic: true,
        viewCount: true,
        likeCount: true,
        downloadCount: true,
        favoriteCount: true,
        createdAt: true,
        category: { select: { slug: true, name: true } },
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                username: true,
                displayName: true,
                verified: true,
                avatarUrl: true,
              },
            },
          },
        },
        // Moderators need to see every variation asset in the pending post.
        assets: {
          select: { variant: true, objectKey: true, width: true, height: true },
          orderBy: { variant: "asc" },
        },
        tags: {
          select: { tag: { select: { slug: true, name: true } } },
          take: 8,
        },
      },
    }),
  ]);

  const variationMeta = await readVariationMetadataMany(items.map((w) => w.id));

  const data = items.map((w) => {
    const groups = groupVariationAssets(w.assets, variationMeta[w.id]);
    const previewAsset =
      groups[0]?.preview ??
      w.assets.find((a) => a.variant === "grid") ??
      w.assets.find((a) => a.variant === "thumbnail") ??
      w.assets.find((a) => a.variant === "original") ??
      null;

    return {
      id: w.id,
      slug: w.slug,
      title: w.title,
      description: w.description,
      status: w.status,
      license: w.license,
      orientation: w.orientation,
      dominantColor: w.dominantColor,
      sourceType: w.sourceType,
      isPublic: w.isPublic,
      viewCount: w.viewCount,
      likeCount: w.likeCount,
      downloadCount: w.downloadCount,
      favoriteCount: w.favoriteCount,
      createdAt: w.createdAt,
      category: w.category,
      creator: {
        id: w.user.id,
        email: w.user.email,
        username: w.user.profile?.username ?? null,
        displayName: w.user.profile?.displayName ?? null,
        verified: w.user.profile?.verified ?? false,
        avatarUrl: w.user.profile?.avatarUrl ?? null,
      },
      asset: previewAsset
        ? {
            variant: previewAsset.variant,
            objectKey: previewAsset.objectKey,
            width: previewAsset.width,
            height: previewAsset.height,
          }
        : null,
      assets: w.assets,
      variationCount: groups.length,
      variations: groups.map((group) => ({
        index: group.index,
        label: group.label,
        preview: group.preview,
      })),
      tags: w.tags.map((t) => t.tag),
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
