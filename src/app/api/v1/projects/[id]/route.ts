import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { enrichProjectAssets } from "@/lib/projects";
import { deleteProjectMeta, getProjectMeta } from "@/lib/projects-meta";

/**
 * Creative Projects (Phase 7) — single project endpoints.
 *
 * GET    /api/v1/projects/[id]   — fetch project + assets (wallpaper detail)
 *                                  + notes. Owner only.
 * PATCH  /api/v1/projects/[id]   — update name / description. Owner only.
 * DELETE /api/v1/projects/[id]   — delete project (cascade). Owner only.
 *
 * Non-owners receive 404 — existence is never revealed.
 *
 * Note: the Prisma schema declares only the scalar `wallpaperId` /
 * `generationId` columns on `ProjectAsset` (no relations). The related
 * Wallpaper / AiGeneration rows are bulk-fetched via `enrichProjectAssets`.
 */

/**
 * GET /api/v1/projects/[id]
 * Returns a single project with assets (each asset includes the related
 * wallpaper slug/title/grid asset, when applicable) and notes.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const { id } = await params;
  const userId = result.session.user.id;

  const project = await db.creativeProject.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      coverUrl: true,
      isPublic: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
      assets: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          assetType: true,
          wallpaperId: true,
          generationId: true,
          note: true,
          createdAt: true,
        },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        select: { id: true, content: true, createdAt: true },
      },
    },
  });

  if (!project || project.userId !== userId) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Project not found." } },
      { status: 404 },
    );
  }

  const [enrichedAssets, meta] = await Promise.all([
    enrichProjectAssets(project.assets),
    getProjectMeta(id),
  ]);

  return NextResponse.json({
    data: {
      id: project.id,
      name: project.name,
      description: project.description,
      coverUrl: project.coverUrl,
      isPublic: project.isPublic,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      assets: enrichedAssets,
      notes: project.notes,
      meta,
    },
  });
}

const PatchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters" })
    .max(80, { message: "Name must be at most 80 characters" })
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, { message: "Description must be at most 500 characters" })
    .nullable()
    .optional(),
  coverUrl: z
    .string()
    .trim()
    .url()
    .nullable()
    .optional()
    .or(z.literal(""))
    .optional(),
  isPublic: z.boolean().optional(),
});

/**
 * PATCH /api/v1/projects/[id]
 * Updates the project name / description / coverUrl / isPublic. Owner only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const { id } = await params;
  const userId = result.session.user.id;

  const existing = await db.creativeProject.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!existing || existing.userId !== userId) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Project not found." } },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const parsed = PatchSchema.safeParse(body);
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

  // Build the update payload, handling the empty-string -> null case for coverUrl.
  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.isPublic !== undefined) data.isPublic = parsed.data.isPublic;
  if (parsed.data.coverUrl !== undefined) {
    const v = parsed.data.coverUrl;
    data.coverUrl = !v || v.length === 0 ? null : v;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "No updatable fields." } },
      { status: 400 },
    );
  }

  const updated = await db.creativeProject.update({
    where: { id },
    data: data as never,
    select: {
      id: true,
      name: true,
      description: true,
      coverUrl: true,
      isPublic: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ data: updated });
}

/**
 * DELETE /api/v1/projects/[id]
 * Deletes a project and cascades to its assets + notes. Owner only.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const { id } = await params;
  const userId = result.session.user.id;

  const existing = await db.creativeProject.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!existing || existing.userId !== userId) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Project not found." } },
      { status: 404 },
    );
  }

  // Prisma cascade deletes handle ProjectAsset and ProjectNote automatically.
  await db.creativeProject.delete({ where: { id } });
  await deleteProjectMeta(id);

  return NextResponse.json({
    data: { deleted: true },
    message: "Project deleted.",
  });
}
