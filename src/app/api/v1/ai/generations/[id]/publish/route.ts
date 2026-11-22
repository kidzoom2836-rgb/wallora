import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { slugify } from "@/lib/slugify";
import { CANONICAL_VARIANTS } from "@/lib/wallpaper-variants";

/**
 * POST /api/v1/ai/generations/[id]/publish
 *
 * Publish a completed AI generation as ONE pending, private wallpaper post.
 * Admins approve it into Discover later. No schema changes: the link between
 * the generation and its wallpaper is stored as JSON in the existing
 * StoredBlob table, keyed by generation id. That unique key also makes the
 * endpoint idempotent — repeated calls return the same wallpaper.
 *
 * Owner-only. Returns { data: { id, slug, status, moderationNote } }.
 */

const PUBLISH_KEY_PREFIX = "meta/ai-generation/";

type PublishLink = { wallpaperId: string };

function publishKey(generationId: string): string {
  return `${PUBLISH_KEY_PREFIX}${generationId}/published.json`;
}

function parseLink(data: Uint8Array): PublishLink | null {
  try {
    const parsed = JSON.parse(Buffer.from(data).toString("utf8")) as PublishLink;
    return typeof parsed?.wallpaperId === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function deriveTitle(prompt: string): string {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  if (!cleaned) return "AI generated wallpaper";
  const shortened = cleaned.length > 110 ? `${cleaned.slice(0, 107)}…` : cleaned;
  return shortened.charAt(0).toUpperCase() + shortened.slice(1);
}

function deriveFormat(url: string): { format: string; mimeType: string } {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".png")) return { format: "png", mimeType: "image/png" };
  if (path.endsWith(".webp")) return { format: "webp", mimeType: "image/webp" };
  return { format: "jpg", mimeType: "image/jpeg" };
}

function deriveOrientation(width: number, height: number): string {
  if (width > height * 1.1) return "landscape";
  if (height > width * 1.1) return "portrait";
  return "square";
}

function responseData(wallpaper: { id: string; slug: string; status: string }) {
  return {
    id: wallpaper.id,
    slug: wallpaper.slug,
    status: wallpaper.status,
    moderationNote:
      "Your AI generation has been submitted for review. It stays private until an admin approves it.",
  };
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const userId = result.session.user.id;
  const { id } = await params;
  const key = publishKey(id);

  // Idempotency check first — a repeated publish returns the existing post.
  const existingLink = await db.storedBlob.findUnique({
    where: { key },
    select: { data: true },
  });
  if (existingLink) {
    const link = parseLink(existingLink.data);
    if (link) {
      const existing = await db.wallpaper.findUnique({
        where: { id: link.wallpaperId },
        select: { id: true, slug: true, status: true, userId: true },
      });
      if (existing && existing.userId === userId) {
        return NextResponse.json({ data: responseData(existing) });
      }
    }
    // Stale link (wallpaper deleted or ownership mismatch) — remove it and
    // allow a fresh publish below.
    await db.storedBlob.delete({ where: { key } }).catch(() => undefined);
  }

  const generation = await db.aiGeneration.findUnique({ where: { id } });
  if (!generation || generation.userId !== userId) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Generation not found." } },
      { status: 404 },
    );
  }

  if (generation.status !== "completed" || !generation.publicUrl) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Only a completed generation with an image can be published.",
        },
      },
      { status: 400 },
    );
  }

  // Reasonable default: the seeded "abstract" category, or the first seeded
  // category. categoryId is nullable, so a fresh DB without seeds is safe.
  const category =
    (await db.category.findUnique({ where: { slug: "abstract" } })) ??
    (await db.category.findFirst({ orderBy: { sortOrder: "asc" } }));

  const title = deriveTitle(generation.prompt);
  const slug = `${slugify(title) || "ai-wallpaper"}-${Date.now().toString(36).slice(-6)}`;
  const objectKey = generation.publicUrl;
  const { format, mimeType } = deriveFormat(objectKey);
  const width = generation.width || 1024;
  const height = generation.height || 1024;

  try {
    const wallpaper = await db.$transaction(
      async (tx) => {
        const created = await tx.wallpaper.create({
          data: {
            slug,
            title,
            description: generation.enhancedPrompt ?? generation.prompt,
            userId,
            categoryId: category?.id ?? null,
            status: "pending",
            license: "Personal",
            sourceType: "ai",
            isPublic: false,
            orientation: deriveOrientation(width, height),
            dominantColor: null,
          },
        });

        // Reuse the generated image for every standard asset slot so existing
        // public cards, detail pages, download and moderation reads work once
        // an admin approves the post.
        await tx.wallpaperAsset.createMany({
          data: CANONICAL_VARIANTS.map((variant) => ({
            wallpaperId: created.id,
            variant,
            objectKey,
            width,
            height,
            fileSize: generation.fileSize,
            format,
            mimeType,
          })),
        });

        const payload = Buffer.from(
          JSON.stringify({ wallpaperId: created.id } satisfies PublishLink),
          "utf8",
        );
        await tx.storedBlob.create({
          data: {
            key,
            data: payload,
            contentType: "application/json",
            size: payload.length,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: "ai_generation.publish",
            targetType: "wallpaper",
            targetId: created.id,
            metadata: JSON.stringify({
              generationId: id,
              slug,
              title,
              status: "pending",
              sourceType: "ai",
            }),
          },
        });

        return created;
      },
      { timeout: 15000, maxWait: 10000 },
    );

    return NextResponse.json(
      { data: responseData(wallpaper) },
      { status: 201 },
    );
  } catch (err) {
    // Concurrent publish: the unique StoredBlob key decides the winner.
    if ((err as { code?: string } | null)?.code === "P2002") {
      const winnerLink = await db.storedBlob.findUnique({
        where: { key },
        select: { data: true },
      });
      const link = winnerLink ? parseLink(winnerLink.data) : null;
      if (link) {
        const winner = await db.wallpaper.findUnique({
          where: { id: link.wallpaperId },
          select: { id: true, slug: true, status: true, userId: true },
        });
        if (winner && winner.userId === userId) {
          return NextResponse.json({ data: responseData(winner) });
        }
      }
    }
    console.error("[ai.publish] failed:", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Could not publish the generation. Please try again." } },
      { status: 500 },
    );
  }
}
