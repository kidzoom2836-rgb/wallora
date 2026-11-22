import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { enrichProjectAssets } from "@/lib/projects";
import { getProjectMeta, getShoutouts } from "@/lib/projects-meta";
import { getTier } from "@/lib/verification/store";

export const dynamic = "force-dynamic";

/** GET /api/v1/projects/showcase/[id] — a public project showcase page. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
      user: {
        select: {
          id: true,
          profile: { select: { username: true, displayName: true, verified: true, bio: true, avatarUrl: true } },
        },
      },
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
        orderBy: { createdAt: "asc" },
        select: { id: true, content: true, createdAt: true },
      },
    },
  });

  if (!project || !project.isPublic) {
    return NextResponse.json({ error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }

  const [assets, meta, shoutouts, tier] = await Promise.all([
    enrichProjectAssets(project.assets),
    getProjectMeta(id),
    getShoutouts(id),
    getTier(project.userId),
  ]);

  return NextResponse.json({
    data: {
      id: project.id,
      name: project.name,
      description: project.description,
      coverUrl: project.coverUrl,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      assets,
      notes: project.notes,
      meta,
      shoutouts,
      owner: {
        id: project.userId,
        username: project.user.profile?.username ?? null,
        displayName: project.user.profile?.displayName ?? null,
        bio: project.user.profile?.bio ?? null,
        avatarUrl: project.user.profile?.avatarUrl ?? null,
        verified: project.user.profile?.verified ?? false,
        tier,
      },
    },
  });
}
