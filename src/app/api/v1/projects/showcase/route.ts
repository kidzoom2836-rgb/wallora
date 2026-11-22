import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getProjectMetas, getShoutoutCounts } from "@/lib/projects-meta";
import { getTiersForUsers } from "@/lib/verification/store";

export const dynamic = "force-dynamic";

/** GET /api/v1/projects/showcase — public projects the community can explore. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(36, Math.max(1, parseInt(searchParams.get("limit") ?? "18", 10) || 18));

  const where: Record<string, unknown> = { isPublic: true };
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { description: { contains: q } },
    ];
  }

  const [total, projects] = await Promise.all([
    db.creativeProject.count({ where: where as never }),
    db.creativeProject.findMany({
      where: where as never,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        coverUrl: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        _count: { select: { assets: true, notes: true } },
        user: {
          select: {
            id: true,
            profile: { select: { username: true, displayName: true, verified: true } },
          },
        },
      },
    }),
  ]);

  const ids = projects.map((p) => p.id);
  const [metas, shoutouts, tiers] = await Promise.all([
    getProjectMetas(ids),
    getShoutoutCounts(ids),
    getTiersForUsers(projects.map((p) => p.userId)),
  ]);

  return NextResponse.json({
    data: {
      items: projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        coverUrl: p.coverUrl,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        assetCount: p._count.assets,
        noteCount: p._count.notes,
        shoutoutCount: shoutouts[p.id] ?? 0,
        meta: metas[p.id],
        owner: {
          id: p.userId,
          username: p.user.profile?.username ?? null,
          displayName: p.user.profile?.displayName ?? null,
          verified: p.user.profile?.verified ?? false,
          tier: tiers[p.userId] ?? "free",
        },
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    },
  });
}
