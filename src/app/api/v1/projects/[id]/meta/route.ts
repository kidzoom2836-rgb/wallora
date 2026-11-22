import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getAuthSession, requireVerification } from "@/lib/auth-helpers";
import {
  getProjectMeta,
  getShoutouts,
  setProjectMeta,
  type ProjectMeta,
  type ProjectStatus,
} from "@/lib/projects-meta";

export const dynamic = "force-dynamic";

const STATUSES: ProjectStatus[] = ["planning", "in_progress", "completed", "archived"];

const PatchSchema = z.object({
  status: z.enum(["planning", "in_progress", "completed", "archived"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  milestones: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().trim().min(1).max(120),
        done: z.boolean(),
        completedAt: z.string().nullable().optional(),
      }),
    )
    .max(40)
    .optional(),
});

/** GET /api/v1/projects/[id]/meta — owner, or anyone when the project is public. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = await db.creativeProject.findUnique({
    where: { id },
    select: { userId: true, isPublic: true },
  });
  if (!project) {
    return NextResponse.json({ error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }

  const session = await getAuthSession();
  const isOwner = session?.user?.id === project.userId;
  if (!isOwner && !project.isPublic) {
    return NextResponse.json({ error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }

  const [meta, shoutouts] = await Promise.all([getProjectMeta(id), getShoutouts(id)]);
  return NextResponse.json({ data: { ...meta, shoutouts, isOwner } });
}

/** PATCH /api/v1/projects/[id]/meta — update showcase metadata. Owner only. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireVerification();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const project = await db.creativeProject.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!project || project.userId !== auth.session.user.id) {
    return NextResponse.json({ error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "validation_error", message: "Invalid JSON body." } }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: parsed.error.issues[0]?.message ?? "Invalid request." } },
      { status: 400 },
    );
  }

  const patch: Partial<ProjectMeta> = {};
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.progress !== undefined) patch.progress = parsed.data.progress;
  if (parsed.data.targetDate !== undefined) patch.targetDate = parsed.data.targetDate;
  if (parsed.data.milestones !== undefined) {
    patch.milestones = parsed.data.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      done: m.done,
      completedAt: m.completedAt ?? (m.done ? new Date().toISOString() : null),
    }));
  }

  const meta = await setProjectMeta(id, patch);
  return NextResponse.json({ data: meta, message: "Project progress updated." });
}

export { STATUSES };
