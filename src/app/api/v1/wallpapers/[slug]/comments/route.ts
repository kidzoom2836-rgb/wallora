import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireVerification } from "@/lib/auth-helpers";

/**
 * GET  /api/v1/wallpapers/[slug]/comments  — list comments (public)
 * POST /api/v1/wallpapers/[slug]/comments  — add a comment (auth required)
 *
 * Comments are public to read but require an authenticated user to write.
 * Returned newest-first, limited to 50.
 */

const MAX_COMMENTS = 50;

const CommentCreateSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, { message: "Comment cannot be empty." })
    .max(500, { message: "Comment must be 500 characters or fewer." }),
});

async function getWallpaperId(slug: string) {
  const w = await db.wallpaper.findUnique({
    where: { slug },
    select: { id: true, status: true, isPublic: true },
  });
  if (!w || w.status !== "approved" || !w.isPublic) return null;
  return w.id;
}

/** GET — newest first, 50 max. Includes commenter profile snapshot. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const wallpaperId = await getWallpaperId(slug);
  if (!wallpaperId) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Wallpaper not found or not available." } },
      { status: 404 },
    );
  }

  const comments = await db.comment.findMany({
    where: { wallpaperId },
    orderBy: { createdAt: "desc" },
    take: MAX_COMMENTS,
    select: {
      id: true,
      content: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          profile: {
              select: { username: true, displayName: true, avatarUrl: true, verified: true },
          },
        },
      },
    },
  });

  const items = comments.map((c) => ({
    id: c.id,
    content: c.content,
    createdAt: c.createdAt,
    author: {
      id: c.user.id,
      username: c.user.profile?.username ?? null,
      displayName: c.user.profile?.displayName ?? null,
      avatarUrl: c.user.profile?.avatarUrl ?? null,
      verified: c.user.profile?.verified ?? false,
    },
  }));

  return NextResponse.json({
    data: {
      items,
      total: items.length,
      limit: MAX_COMMENTS,
    },
  });
}

/** POST — auth required. Body: { content: string (1–500) }. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const result = await requireVerification();
  if (!result.ok) return result.response;

  const { slug } = await params;
  const wallpaperId = await getWallpaperId(slug);
  if (!wallpaperId) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Wallpaper not found or not available." } },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }

  const parsed = CommentCreateSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: firstError?.message ?? "Invalid comment.",
        },
      },
      { status: 400 },
    );
  }

  const userId = result.session.user.id;
  const content = parsed.data.content;

  const comment = await db.comment.create({
    data: { wallpaperId, userId, content },
    select: {
      id: true,
      content: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          profile: {
            select: { username: true, displayName: true, avatarUrl: true, verified: true },
          },
        },
      },
    },
  });

  return NextResponse.json(
    {
      data: {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        author: {
          id: comment.user.id,
          username: comment.user.profile?.username ?? null,
          displayName: comment.user.profile?.displayName ?? null,
          avatarUrl: comment.user.profile?.avatarUrl ?? null,
          verified: comment.user.profile?.verified ?? false,
        },
      },
    },
    { status: 201 },
  );
}
