import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";

/**
 * GET /api/v1/ai/generations/[id]
 * Returns a specific generation. Only the owner can access it.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const { id } = await params;

  const generation = await db.aiGeneration.findUnique({
    where: { id },
  });

  if (!generation || generation.userId !== result.session.user.id) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Generation not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: generation });
}

/**
 * DELETE /api/v1/ai/generations/[id]
 * Deletes a generation record (and optionally the stored image).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const { id } = await params;

  const generation = await db.aiGeneration.findUnique({
    where: { id },
    select: { userId: true, objectKey: true },
  });

  if (!generation || generation.userId !== result.session.user.id) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Generation not found." } },
      { status: 404 },
    );
  }

  // Optionally delete the stored image
  if (generation.objectKey) {
    try {
      const { getStorage } = await import("@/lib/storage");
      const storage = getStorage();
      await storage.deleteObject(generation.objectKey);
    } catch {
      // non-fatal — the record is still deleted
    }
  }

  await db.aiGeneration.delete({ where: { id } });

  return NextResponse.json({ data: { deleted: true } });
}
