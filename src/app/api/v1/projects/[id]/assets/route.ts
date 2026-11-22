import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { enrichProjectAssets } from "@/lib/projects";

/**
 * Creative Projects (Phase 7) — project assets endpoints.
 *
 * GET  /api/v1/projects/[id]/assets   — list assets in a project. Owner only.
 * POST /api/v1/projects/[id]/assets   — add an asset (wallpaperId or
 *                                        generationId + assetType + note).
 *
 * Non-owners receive 404 — existence is never revealed.
 *
 * Note: the Prisma schema declares only the scalar `wallpaperId` /
 * `generationId` columns on `ProjectAsset` (no relations). The related
 * Wallpaper / AiGeneration rows are bulk-fetched via `enrichProjectAssets`.
 */

/**
 * GET /api/v1/projects/[id]/assets
 * Returns all assets in a project, ordered newest first. Owner only.
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
    select: { userId: true },
  });

  if (!project || project.userId !== userId) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Project not found." } },
      { status: 404 },
    );
  }

  const assets = await db.projectAsset.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      assetType: true,
      wallpaperId: true,
      generationId: true,
      note: true,
      createdAt: true,
    },
  });

  const enriched = await enrichProjectAssets(assets);

  return NextResponse.json({ data: enriched });
}

const CreateAssetSchema = z
  .object({
    wallpaperId: z.string().trim().min(1).optional(),
    generationId: z.string().trim().min(1).optional(),
    assetType: z.enum(["wallpaper", "generation"]).default("wallpaper"),
    note: z
      .string()
      .trim()
      .max(500, { message: "Note must be at most 500 characters" })
      .optional(),
  })
  .refine(
    (data) =>
      (data.assetType === "wallpaper" && !!data.wallpaperId) ||
      (data.assetType === "generation" && !!data.generationId),
    {
      message:
        "wallpaperId is required for assetType=wallpaper, generationId for assetType=generation.",
      path: ["assetType"],
    },
  );

/**
 * POST /api/v1/projects/[id]/assets
 * Adds an asset to a project. Owner only. Returns 201.
 *
 * The referenced wallpaperId / generationId must belong to the same user
 * (we verify ownership of the related record). Duplicate (projectId,
 * wallpaperId) / (projectId, generationId) pairs are rejected with 409.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const { id } = await params;
  const userId = result.session.user.id;

  const project = await db.creativeProject.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!project || project.userId !== userId) {
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

  const parsed = CreateAssetSchema.safeParse(body);
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

  const { assetType, wallpaperId, generationId, note } = parsed.data;

  // Verify the referenced asset exists and belongs to the same user.
  if (assetType === "wallpaper" && wallpaperId) {
    const w = await db.wallpaper.findUnique({
      where: { id: wallpaperId },
      select: { userId: true },
    });
    if (!w || w.userId !== userId) {
      return NextResponse.json(
        {
          error: {
            code: "not_found",
            message: "Referenced wallpaper not found.",
          },
        },
        { status: 404 },
      );
    }
  }

  if (assetType === "generation" && generationId) {
    const g = await db.aiGeneration.findUnique({
      where: { id: generationId },
      select: { userId: true },
    });
    if (!g || g.userId !== userId) {
      return NextResponse.json(
        {
          error: {
            code: "not_found",
            message: "Referenced generation not found.",
          },
        },
        { status: 404 },
      );
    }
  }

  // Reject duplicate (project, wallpaper) / (project, generation) pairs.
  const dupWhere: Record<string, unknown> = { projectId: id };
  if (assetType === "wallpaper") dupWhere.wallpaperId = wallpaperId;
  else dupWhere.generationId = generationId;

  const existing = await db.projectAsset.findFirst({
    where: dupWhere as never,
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        error: {
          code: "conflict",
          message: "This asset is already in the project.",
        },
      },
      { status: 409 },
    );
  }

  const asset = await db.projectAsset.create({
    data: {
      projectId: id,
      assetType,
      wallpaperId: assetType === "wallpaper" ? wallpaperId : null,
      generationId: assetType === "generation" ? generationId : null,
      note: note ?? null,
    },
    select: {
      id: true,
      assetType: true,
      wallpaperId: true,
      generationId: true,
      note: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    { data: asset, message: "Asset added to project." },
    { status: 201 },
  );
}

/** DELETE /api/v1/projects/[id]/assets?assetId=... — remove an asset. Owner only. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const { id } = await params;
  const assetId = new URL(request.url).searchParams.get("assetId")?.trim();
  if (!assetId) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "assetId is required." } },
      { status: 400 },
    );
  }

  const project = await db.creativeProject.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!project || project.userId !== result.session.user.id) {
    return NextResponse.json({ error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }

  const asset = await db.projectAsset.findFirst({
    where: { id: assetId, projectId: id },
    select: { id: true },
  });
  if (!asset) {
    return NextResponse.json({ error: { code: "not_found", message: "Asset not found." } }, { status: 404 });
  }
  await db.projectAsset.delete({ where: { id: assetId } });
  return NextResponse.json({ data: { deleted: true }, message: "Asset removed." });
}

