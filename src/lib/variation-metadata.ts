import { db } from "@/lib/db";
import type { VariationMetadata } from "./wallpaper-variants";

/**
 * Per-variation labels/captions live in StoredBlob as JSON keyed by wallpaper
 * id. No schema changes are needed: StoredBlob is the existing generic blob
 * table (also used by the database storage adapter under `w/...` keys).
 */

const META_PREFIX = "meta/wallpaper/";

export function variationMetaKey(wallpaperId: string): string {
  return `${META_PREFIX}${wallpaperId}/variations.json`;
}

function parseMetadata(data: Uint8Array): VariationMetadata | null {
  try {
    const parsed = JSON.parse(Buffer.from(data).toString("utf8")) as VariationMetadata;
    if (parsed?.version !== 1 || !Array.isArray(parsed.variations)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function readVariationMetadata(
  wallpaperId: string,
): Promise<VariationMetadata | null> {
  const blob = await db.storedBlob.findUnique({
    where: { key: variationMetaKey(wallpaperId) },
    select: { data: true },
  });
  return blob ? parseMetadata(blob.data) : null;
}

/** Bulk read for list endpoints — one query instead of one per card. */
export async function readVariationMetadataMany(
  wallpaperIds: string[],
): Promise<Record<string, VariationMetadata>> {
  const ids = Array.from(new Set(wallpaperIds.filter(Boolean)));
  if (!ids.length) return {};

  const blobs = await db.storedBlob.findMany({
    where: { key: { in: ids.map(variationMetaKey) } },
    select: { key: true, data: true },
  });

  const result: Record<string, VariationMetadata> = {};
  for (const blob of blobs) {
    const parsed = parseMetadata(blob.data);
    if (parsed?.wallpaperId) result[parsed.wallpaperId] = parsed;
  }
  return result;
}
