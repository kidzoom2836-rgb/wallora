import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRole, ROLES } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { processImage } from "@/lib/image";
import { getStorage } from "@/lib/storage";
import { detectMimeType, extensionForMime, validateImageFile } from "@/lib/upload-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/v1/admin/wallpapers/import/pixabay
 *
 * Super-admin-only importer. Pulls royalty-free Pixabay photos into the
 * WALLORA verified account so they appear in Discover. Responses are cached
 * for 24 hours to respect Pixabay's API policy.
 */

const ImportSchema = z.object({
  categorySlug: z.string().trim().min(1).max(60),
  query: z.string().trim().max(80).optional(),
  perPage: z.number().int().min(1).max(20).default(10),
  dryRun: z.boolean().default(false),
});

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 25_000;

/** Seeded Discover categories mapped to useful Pixabay photo searches. */
const CATEGORY_QUERIES: Record<string, string> = {
  nature: "nature landscape forest",
  technology: "technology computer",
  cars: "car vehicle",
  anime: "anime art",
  gaming: "gaming console",
  architecture: "architecture building",
  minimalism: "minimal minimalist",
  luxury: "luxury interior",
  abstract: "abstract art",
  photography: "photography portrait",
  fashion: "fashion style",
  interior: "interior design",
  illustration: "illustration art",
};

type PixabayHit = {
  id: number;
  tags?: string;
  user?: string;
  pageURL?: string;
  webformatURL?: string;
  largeImageURL?: string;
};

function isAllowedImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith("https://")) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "pixabay.com" ||
        url.hostname === "cdn.pixabay.com" ||
        url.hostname.endsWith(".pixabay.com"))
    );
  } catch {
    return false;
  }
}

function cacheKey(query: string, perPage: number): string {
  const hash = createHash("sha256").update(`${query}:${perPage}`).digest("hex").slice(0, 24);
  return `cache/pixabay/images/${hash}.json`;
}

async function loadHits(query: string, perPage: number): Promise<PixabayHit[]> {
  const apiKey = process.env.PIXABAY_API_KEY;
  const key = cacheKey(query, perPage);

  const cached = await db.storedBlob.findUnique({ where: { key } });
  if (cached) {
    try {
      const parsed = JSON.parse(Buffer.from(cached.data).toString("utf8"));
      if (Array.isArray(parsed?.hits) && Date.now() - parsed.fetchedAt < CACHE_TTL_MS) {
        return parsed.hits as PixabayHit[];
      }
    } catch {
      // Corrupt cache entries are refreshed below.
    }
  }

  if (!apiKey) {
    throw new Error("PIXABAY_API_KEY is not configured on the server.");
  }

  const url = new URL("https://pixabay.com/api/");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("per_page", String(perPage));

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Pixabay returned ${response.status}.`);
  }
  const json = await response.json();
  const hits: PixabayHit[] = Array.isArray(json?.hits) ? json.hits : [];
  const payload = Buffer.from(JSON.stringify({ fetchedAt: Date.now(), hits }), "utf8");
  await db.storedBlob.upsert({
    where: { key },
    update: { data: payload, contentType: "application/json", size: payload.length },
    create: { key, data: payload, contentType: "application/json", size: payload.length },
  });
  return hits;
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const response = await fetch(url, {
    headers: { Accept: "image/jpeg,image/png,image/webp,image/*" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "error",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Image request returned ${response.status}.`);
  }
  const declared = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (declared && !declared.startsWith("image/")) {
    throw new Error(`Unexpected image content type: ${declared}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error("Image was empty.");
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error("Image exceeds the 10 MB limit.");
  const mimeType = detectMimeType(buffer);
  if (!mimeType) throw new Error("Image signature was not recognized.");
  const validation = await validateImageFile(buffer, mimeType);
  if (!validation.ok) throw new Error(validation.error);
  return { buffer, mimeType };
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(ROLES.SUPER_ADMIN);
  if (!auth.ok) return auth.response;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: parsed.error.issues[0]?.message ?? "Invalid import request.",
        },
      },
      { status: 400 },
    );
  }

  const { categorySlug, query, perPage, dryRun } = parsed.data;
  const category = await db.category.findUnique({ where: { slug: categorySlug } });
  if (!category) {
    return NextResponse.json(
      { error: { code: "validation_error", message: `Unknown category: ${categorySlug}` } },
      { status: 400 },
    );
  }

  const searchQuery = query?.trim() || CATEGORY_QUERIES[categorySlug] || category.name;
  let hits: PixabayHit[];
  try {
    hits = await loadHits(searchQuery, perPage);
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "upstream_error",
          message: error instanceof Error ? error.message : "Could not reach Pixabay.",
        },
      },
      { status: 503 },
    );
  }

  const usable = hits.filter((hit) => !!hit.id && isAllowedImageUrl(hit.largeImageURL ?? hit.webformatURL));
  if (dryRun) {
    return NextResponse.json({
      data: {
        dryRun: true,
        category: categorySlug,
        query: searchQuery,
        fetched: usable.length,
        hits: usable.slice(0, perPage).map((hit) => ({
          id: hit.id,
          title: hit.tags?.split(",").slice(0, 3).join(" · ") || `Pixabay ${hit.id}`,
          creator: hit.user ?? "Pixabay creator",
          pageUrl: hit.pageURL,
        })),
      },
    });
  }

  // Attribute imported wallpapers to the verified @wallora curator account.
  // The REST call is authenticated as the acting super admin and audited.
  const curator = await db.user.findFirst({
    where: {
      profile: { username: "wallora" },
      role: { in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] },
    },
    select: { id: true },
  });
  const curatorId = curator?.id ?? auth.session.user.id;

  const storage = getStorage();
  const results: {
    id: number;
    slug: string;
    status: "imported" | "skipped" | "failed";
    reason?: string;
  }[] = [];

  for (const hit of usable) {
    const slug = `pixabay-${hit.id}`;
    const existing = await db.wallpaper.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      results.push({ id: hit.id, slug, status: "skipped", reason: "Already imported" });
      continue;
    }

    const imageUrl = hit.largeImageURL ?? hit.webformatURL;
    if (!isAllowedImageUrl(imageUrl)) {
      results.push({ id: hit.id, slug, status: "failed", reason: "Image host not allowed" });
      continue;
    }

    try {
      const { buffer, mimeType } = await downloadImage(imageUrl);
      const processed = await processImage(buffer);
      const storedVariants: {
        variant: string;
        objectKey: string;
        width: number;
        height: number;
        fileSize: number;
        format: string;
        mimeType: string;
      }[] = [];

      for (const variant of processed.variants) {
        const ext = extensionForMime(variant.mimeType);
        const key = `w/${curatorId}/${slug}/${variant.variant}.${ext}`;
        const stored = await storage.putObject(key, variant.buffer, variant.mimeType);
        storedVariants.push({
          variant: variant.variant,
          objectKey: stored.key,
          width: variant.width,
          height: variant.height,
          fileSize: variant.fileSize,
          format: variant.format,
          mimeType: variant.mimeType,
        });
      }

      const tags = (hit.tags ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 8);
      const title = tags.slice(0, 3).join(" · ") || `Pixabay photo ${hit.id}`;
      const description = `Photo by ${hit.user ?? "a Pixabay creator"} via Pixabay. ${
        hit.pageURL ?? ""
      }`.trim();

      const wallpaper = await db.$transaction(
        async (tx) => {
          const created = await tx.wallpaper.create({
            data: {
              slug,
              title,
              description,
              userId: curatorId,
              categoryId: category.id,
              status: "approved",
              license: "Pixabay License",
              sourceType: "pixabay",
              orientation: processed.metadata.orientation,
              dominantColor: processed.metadata.dominantColor,
              isPublic: true,
            },
          });

          await tx.wallpaperAsset.createMany({
            data: storedVariants.map((variant) => ({
              wallpaperId: created.id,
              variant: variant.variant,
              objectKey: variant.objectKey,
              width: variant.width,
              height: variant.height,
              fileSize: variant.fileSize,
              format: variant.format,
              mimeType: variant.mimeType,
            })),
          });

          for (const tagName of tags) {
            const tagSlug = tagName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "");
            if (!tagSlug) continue;
            const tag = await tx.tag.upsert({
              where: { slug: tagSlug },
              update: {},
              create: { slug: tagSlug, name: tagName },
            });
            await tx.wallpaperTag.upsert({
              where: { wallpaperId_tagId: { wallpaperId: created.id, tagId: tag.id } },
              update: {},
              create: { wallpaperId: created.id, tagId: tag.id },
            });
          }

          await tx.auditLog.create({
            data: {
              actorId: auth.session.user.id,
              action: "admin.pixabay_import",
              targetType: "wallpaper",
              targetId: created.id,
              metadata: JSON.stringify({
                categorySlug,
                query: searchQuery,
                pixabayId: hit.id,
                curatorId,
                pageUrl: hit.pageURL,
              }),
            },
          });

          return created;
        },
        { timeout: 15000, maxWait: 10000 },
      );

      results.push({ id: hit.id, slug: wallpaper.slug, status: "imported" });
    } catch (error) {
      results.push({
        id: hit.id,
        slug,
        status: "failed",
        reason: error instanceof Error ? error.message.slice(0, 160) : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    data: {
      dryRun: false,
      category: categorySlug,
      query: searchQuery,
      fetched: usable.length,
      imported: results.filter((item) => item.status === "imported").length,
      skipped: results.filter((item) => item.status === "skipped").length,
      failed: results.filter((item) => item.status === "failed").length,
      results,
    },
  });
}
