import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireVerification } from "@/lib/auth-helpers";
import { getShoutouts, toggleShoutout } from "@/lib/projects-meta";

export const dynamic = "force-dynamic";

/** GET /api/v1/projects/[id]/shoutouts — public project only. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = await db.creativeProject.findUnique({
    where: { id },
    select: { isPublic: true },
  });
  if (!project || !project.isPublic) {
    return NextResponse.json({ error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }
  return NextResponse.json({ data: await getShoutouts(id) });
}

/** POST /api/v1/projects/[id]/shoutouts — toggle a shoutout. Verified users only. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireVerification();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const project = await db.creativeProject.findUnique({
    where: { id },
    select: { isPublic: true },
  });
  if (!project || !project.isPublic) {
    return NextResponse.json({ error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }

  const profile = await db.profile.findUnique({
    where: { userId: auth.session.user.id },
    select: { username: true, displayName: true },
  });
  const result = await toggleShoutout(id, {
    id: auth.session.user.id,
    username: profile?.username ?? null,
    displayName: profile?.displayName ?? null,
  });
  return NextResponse.json({ data: result });
}
