import { MAX_VARIATIONS } from "./upload-config";

/**
 * Variation naming for multi-image wallpaper posts.
 *
 * The schema only allows one WallpaperAsset per (wallpaperId, variant), so
 * each source image gets its own response-size variant namespace:
 *
 *   source 1 (base): original / thumbnail / grid / detail / mobile / desktop
 *   source 2:        variation-1-original / variation-1-grid / ...
 *   source 3:        variation-2-original / variation-2-grid / ...
 *
 * The base keeps the original names so every existing single-file client,
 * card, download link and moderation view continues to work unchanged.
 */

export const CANONICAL_VARIANTS = [
  "thumbnail",
  "grid",
  "detail",
  "mobile",
  "desktop",
  "original",
] as const;

export type CanonicalVariant = (typeof CANONICAL_VARIANTS)[number];

export type VariationAsset = {
  variant: string;
  objectKey: string;
  width: number;
  height: number;
  fileSize?: number;
  format?: string;
  mimeType?: string;
};

export type VariationMetaEntry = {
  index: number;
  prefix: string;
  label: string;
  filename: string;
};

export type VariationMetadata = {
  version: 1;
  wallpaperId: string;
  variations: VariationMetaEntry[];
};

export type VariationGroup<T extends VariationAsset> = {
  index: number;
  prefix: string;
  label: string;
  assets: T[];
  original: T | null;
  grid: T | null;
  detail: T | null;
  preview: T | null;
};

/** "" for the base image, "variation-1-" / "variation-2-" for the others. */
export function variationPrefix(index: number): string {
  return index <= 0 ? "" : `variation-${index}-`;
}

export function variationVariantName(
  index: number,
  name: CanonicalVariant,
): string {
  return `${variationPrefix(index)}${name}`;
}

export function defaultVariationLabel(index: number): string {
  return index === 0 ? "Original" : `Variation ${index}`;
}

/** Parse "variation-2-grid" -> 2; returns null for the base namespace. */
export function parseVariationIndex(variant: string): number | null {
  const match = variant.match(/^variation-(\d+)-/);
  if (!match) return null;
  const index = Number(match[1]);
  return Number.isFinite(index) && index > 0 && index < MAX_VARIATIONS ? index : null;
}

export function buildVariationMetadata(
  wallpaperId: string,
  entries: VariationMetaEntry[],
): VariationMetadata {
  return { version: 1, wallpaperId, variations: entries };
}

function canonicalIndex(variant: string): number {
  const base = variant.replace(/^variation-\d+-/, "");
  const index = CANONICAL_VARIANTS.indexOf(base as CanonicalVariant);
  return index < 0 ? 99 : index;
}

function canonicalSort<T extends VariationAsset>(assets: T[]): T[] {
  return [...assets].sort((a, b) => canonicalIndex(a.variant) - canonicalIndex(b.variant));
}

/**
 * Group flat WallpaperAsset rows into one group per source image.
 * Works for legacy single-image rows (no metadata, only base names) and for
 * new multi-image rows, including when the optional StoredBlob metadata is
 * missing or malformed.
 */
export function groupVariationAssets<T extends VariationAsset>(
  assets: T[],
  metadata?: VariationMetadata | null,
): VariationGroup<T>[] {
  if (!assets.length) return [];

  const indices = new Set<number>([0]);
  for (const asset of assets) {
    const index = parseVariationIndex(asset.variant);
    if (index !== null) indices.add(index);
  }
  for (const entry of metadata?.variations ?? []) {
    if (entry.index >= 0 && entry.index < MAX_VARIATIONS) indices.add(entry.index);
  }

  const groups: VariationGroup<T>[] = [];
  for (const index of Array.from(indices).sort((a, b) => a - b)) {
    const prefix = variationPrefix(index);
    const groupAssets = canonicalSort(
      assets.filter((asset) =>
        CANONICAL_VARIANTS.some((name) => asset.variant === `${prefix}${name}`),
      ),
    );
    if (!groupAssets.length) continue;

    const find = (name: CanonicalVariant): T | null =>
      groupAssets.find((asset) => asset.variant === `${prefix}${name}`) ?? null;
    const original = find("original");
    const grid = find("grid");
    const detail = find("detail");
    const label =
      metadata?.variations.find((entry) => entry.index === index)?.label?.trim() ||
      defaultVariationLabel(index);

    groups.push({
      index,
      prefix,
      label,
      assets: groupAssets,
      original,
      grid,
      detail,
      preview: grid ?? detail ?? original ?? groupAssets[0] ?? null,
    });
  }

  return groups;
}
