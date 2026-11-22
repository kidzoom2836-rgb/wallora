import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireVerification } from "@/lib/auth-helpers";
import { getProjectMetas, getShoutoutCounts } from "@/lib/projects-meta";

/**
 * Creative Projects (Phase 7)
 *
 * GET  /api/v1/projects         — list the authenticated user's projects,
 *                                 most recent first, with asset + note counts.
 * POST /api/v1/projects         — create a new project.
 */

/**
 * GET /api/v1/projects
 * Returns the authenticated user's projects (most recent first), including
 * asset and note counts for the sidebar list.
 */
export async function GET() {
  const result = await requireVerification();
  if (!result.ok) return result.response;

  const userId = result.session.user.id;

  const projects = await db.creativeProject.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      coverUrl: true,
      isPublic: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          assets: true,
          notes: true,
        },
      },
    },
  });

  const ids = projects.map((p) => p.id);
  const [metas, shoutouts] = await Promise.all([
    getProjectMetas(ids),
    getShoutoutCounts(ids),
  ]);

  return NextResponse.json({
    data: projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      coverUrl: p.coverUrl,
      isPublic: p.isPublic,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      assetCount: p._count.assets,
      noteCount: p._count.notes,
      shoutoutCount: shoutouts[p.id] ?? 0,
      meta: metas[p.id],
    })),
  });
}

const CreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters" })
    .max(80, { message: "Name must be at most 80 characters" }),
  description: z
    .string()
    .trim()
    .max(500, { message: "Description must be at most 500 characters" })
    .optional(),
  coverUrl: z
    .string()
    .trim()
    .url()
    .optional()
    .or(z.literal(""))
    .optional(),
  isPublic: z.boolean().default(false),
});

/**
 * POST /api/v1/projects
 * Creates a new project owned by the authenticated user. Returns 201.
 */
export async function POST(request: NextRequest) {
  const result = await requireVerification();
  if (!result.ok) return result.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: parsed.error.issues[0]?.message ?? "Invalid request.",
        },
      },
      { status: 400 },
    );
  }

  const { name, description, coverUrl, isPublic } = parsed.data;
  const userId = result.session.user.id;

  const project = await db.creativeProject.create({
    data: {
      userId,
      name,
      description: description ?? null,
      coverUrl: coverUrl && coverUrl.length > 0 ? coverUrl : null,
      isPublic,
    },
    select: {
      id: true,
      name: true,
      description: true,
      coverUrl: true,
      isPublic: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(
    { data: project, message: "Project created." },
    { status: 201 },
  );
}
