import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";

/**
 * Creative Projects (Phase 7) — project notes endpoints.
 *
 * GET  /api/v1/projects/[id]/notes   — list notes (newest first). Owner only.
 * POST /api/v1/projects/[id]/notes   — add a note (content 1-500 chars).
 *                                      Owner only. Returns 201.
 *
 * Non-owners receive 404 — existence is never revealed.
 */

/**
 * GET /api/v1/projects/[id]/notes
 * Returns all notes for a project, ordered newest first. Owner only.
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

  const notes = await db.projectNote.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, content: true, createdAt: true },
  });

  return NextResponse.json({ data: notes });
}

const CreateNoteSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, { message: "Note cannot be empty." })
    .max(500, { message: "Note must be at most 500 characters." }),
});

/**
 * POST /api/v1/projects/[id]/notes
 * Adds a note to a project. Owner only. Returns 201.
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

  const parsed = CreateNoteSchema.safeParse(body);
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

  const note = await db.projectNote.create({
    data: {
      projectId: id,
      content: parsed.data.content,
    },
    select: { id: true, content: true, createdAt: true },
  });

  return NextResponse.json(
    { data: note, message: "Note added." },
    { status: 201 },
  );
}

/** DELETE /api/v1/projects/[id]/notes?noteId=... — remove a note. Owner only. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const { id } = await params;
  const noteId = new URL(request.url).searchParams.get("noteId")?.trim();
  if (!noteId) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "noteId is required." } },
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

  const note = await db.projectNote.findFirst({
    where: { id: noteId, projectId: id },
    select: { id: true },
  });
  if (!note) {
    return NextResponse.json({ error: { code: "not_found", message: "Note not found." } }, { status: 404 });
  }
  await db.projectNote.delete({ where: { id: noteId } });
  return NextResponse.json({ data: { deleted: true }, message: "Note removed." });
}

