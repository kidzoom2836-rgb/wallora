import { db } from "@/lib/db";

/**
 * Creative Projects (Phase 7) — shared asset-enrichment helper.
 *
 * The Prisma schema intentionally stores `wallpaperId` / `generationId` as
 * scalar columns on `ProjectAsset` without declaring relations. This helper
 * bulk-fetches the related Wallpaper + AiGeneration rows for a list of raw
 * project assets and merges them into a single response shape.
 *
 * Used by:
 *   - GET /api/v1/projects/[id]        (project detail with assets)
 *   - GET /api/v1/projects/[id]/assets (asset list)
 */

export type RawProjectAsset = {
  id: string;
  assetType: string;
  wallpaperId: string | null;
  generationId: string | null;
  note: string | null;
  createdAt: Date;
};

export type EnrichedProjectAsset = {
  id: string;
  assetType: string;
  wallpaperId: string | null;
  generationId: string | null;
  note: string | null;
  createdAt: Date;
  wallpaper: {
    id: string;
    slug: string;
    title: string;
    orientation: string;
    dominantColor: string | null;
    gridAsset: { objectKey: string; width: number; height: number } | null;
  } | null;
  generation: {
    id: string;
    prompt: string;
    publicUrl: string | null;
    width: number;
    height: number;
    aspectRatio: string;
  } | null;
};

export async function enrichProjectAssets(
  assets: RawProjectAsset[],
): Promise<EnrichedProjectAsset[]> {
  const wallpaperIds = assets
    .map((a) => a.wallpaperId)
    .filter((v): v is string => !!v);
  const generationIds = assets
    .map((a) => a.generationId)
    .filter((v): v is string => !!v);

  const [wallpapers, generations] = await Promise.all([
    wallpaperIds.length
      ? db.wallpaper.findMany({
          where: { id: { in: wallpaperIds } },
          select: {
            id: true,
            slug: true,
            title: true,
            orientation: true,
            dominantColor: true,
            assets: {
              where: { variant: "grid" },
              select: { objectKey: true, width: true, height: true },
              take: 1,
            },
          },
        })
      : [],
    generationIds.length
      ? db.aiGeneration.findMany({
          where: { id: { in: generationIds } },
          select: {
            id: true,
            prompt: true,
            publicUrl: true,
            width: true,
            height: true,
            aspectRatio: true,
          },
        })
      : [],
  ]);

  const wallpaperById = new Map(wallpapers.map((w) => [w.id, w]));
  const generationById = new Map(generations.map((g) => [g.id, g]));

  return assets.map((a) => {
    const wallpaper = a.wallpaperId ? wallpaperById.get(a.wallpaperId) : undefined;
    const generation = a.generationId ? generationById.get(a.generationId) : undefined;
    return {
      id: a.id,
      assetType: a.assetType,
      wallpaperId: a.wallpaperId,
      generationId: a.generationId,
      note: a.note,
      createdAt: a.createdAt,
      wallpaper: wallpaper
        ? {
            id: wallpaper.id,
            slug: wallpaper.slug,
            title: wallpaper.title,
            orientation: wallpaper.orientation,
            dominantColor: wallpaper.dominantColor,
            gridAsset: wallpaper.assets[0] ?? null,
          }
        : null,
      generation: generation
        ? {
            id: generation.id,
            prompt: generation.prompt,
            publicUrl: generation.publicUrl,
            width: generation.width,
            height: generation.height,
            aspectRatio: generation.aspectRatio,
          }
        : null,
    };
  });
}
