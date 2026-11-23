import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRole, ROLES } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { slugify } from "@/lib/tv/m3u";

export const dynamic = "force-dynamic";

const CreateChannelSchema = z.object({
  name: z.string().trim().min(1).max(180),
  groupName: z.string().trim().min(1).max(120).default("General"),
  streamUrl: z
    .string()
    .trim()
    .url()
    .refine((value) => /^https?:\/\//i.test(value), "Stream URL must be HTTP(S)."),
  logoUrl: z.string().trim().url().nullish(),
  previewUrl: z.string().trim().url().nullish(),
  slug: z.string().trim().max(140).optional(),
  status: z.enum(["active", "hidden", "disabled"]).default("active"),
  sortOrder: z.number().int().min(-100000).max(100000).default(0),
  isFeatured: z.boolean().default(false),
});

function toClientChannel(row: {
  id: string;
  slug: string;
  name: string;
  groupName: string;
  logoUrl: string | null;
  streamUrl: string;
  previewUrl: string | null;
  isFeatured: boolean;
}) {
  return {
    id: row.slug,
    name: row.name,
    group: row.groupName,
    logo: row.logoUrl ?? undefined,
    url: row.streamUrl,
    tvgId: row.id,
    previewUrl: row.previewUrl ?? undefined,
    isFeatured: row.isFeatured,
  };
}

/** GET /api/v1/channels — the DB-backed WALLORA TV guide. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const adminMode = searchParams.get("admin") === "1";
  if (adminMode) {
    const auth = await requireRole(ROLES.SUPER_ADMIN);
    if (!auth.ok) return auth.response;
  }

  const q = (searchParams.get("q") ?? "").trim().slice(0, 120);
  const group = (searchParams.get("group") ?? "").trim().slice(0, 120);
  const featured = searchParams.get("featured") === "1";
  const requestedStatus = searchParams.get("status") ?? "";
  const status =
    adminMode && ["active", "hidden", "disabled"].includes(requestedStatus)
      ? requestedStatus
      : "active";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(500, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "200", 10) || 200));

  const where = {
    status,
    ...(group ? { groupName: { equals: group, mode: "insensitive" as const } } : {}),
    ...(featured ? { isFeatured: true } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { groupName: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.tvChannel.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.tvChannel.count({ where }),
  ]);

  return NextResponse.json({
    data: {
      items: rows.map((row) => ({
        ...toClientChannel(row),
        ...(adminMode
          ? { status: row.status, sortOrder: row.sortOrder, createdAt: row.createdAt }
          : {}),
      })),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      source: "database",
    },
  });
}

/** POST /api/v1/channels — super-admin only. */
export async function POST(request: NextRequest) {
  const auth = await requireRole(ROLES.SUPER_ADMIN);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const parsed = CreateChannelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: parsed.error.issues[0]?.message ?? "Invalid channel.",
        },
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const baseSlug = slugify(input.slug || input.name) || `channel-${Date.now()}`;
  let slug = baseSlug;
  let suffix = 2;
  while (await db.tvChannel.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const row = await db.tvChannel.create({
    data: {
      slug,
      name: input.name,
      groupName: input.groupName,
      streamUrl: input.streamUrl,
      logoUrl: input.logoUrl ?? null,
      previewUrl: input.previewUrl ?? null,
      status: input.status,
      sortOrder: input.sortOrder,
      isFeatured: input.isFeatured,
      createdById: auth.session.user.id,
    },
  });

  return NextResponse.json({ data: toClientChannel(row) }, { status: 201 });
}
