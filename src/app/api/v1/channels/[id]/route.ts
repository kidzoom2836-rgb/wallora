import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRole, ROLES } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { slugify } from "@/lib/tv/m3u";

export const dynamic = "force-dynamic";

const UpdateChannelSchema = z
  .object({
    name: z.string().trim().min(1).max(180).optional(),
    groupName: z.string().trim().min(1).max(120).optional(),
    streamUrl: z
      .string()
      .trim()
      .url()
      .refine((value) => /^https?:\/\//i.test(value), "Stream URL must be HTTP(S).")
      .optional(),
    logoUrl: z.string().trim().url().nullish(),
    previewUrl: z.string().trim().url().nullish(),
    slug: z.string().trim().max(140).optional(),
    status: z.enum(["active", "hidden", "disabled"]).optional(),
    sortOrder: z.number().int().min(-100000).max(100000).optional(),
    isFeatured: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");

async function findChannel(id: string) {
  return db.tvChannel.findFirst({ where: { OR: [{ id }, { slug: id }] } });
}

function badRequest(message: string) {
  return NextResponse.json(
    { error: { code: "validation_error", message } },
    { status: 400 },
  );
}

/** GET /api/v1/channels/:id */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await findChannel(id);
  if (!row) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Channel not found." } },
      { status: 404 },
    );
  }
  return NextResponse.json({
    data: {
      id: row.slug,
      name: row.name,
      group: row.groupName,
      logo: row.logoUrl,
      url: row.streamUrl,
      tvgId: row.id,
      previewUrl: row.previewUrl,
      isFeatured: row.isFeatured,
    },
  });
}

/** PATCH /api/v1/channels/:id — super-admin only. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(ROLES.SUPER_ADMIN);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await findChannel(id);
  if (!existing) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Channel not found." } },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = UpdateChannelSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid channel.");
  }

  const input = parsed.data;
  if (input.slug && input.slug !== existing.slug) {
    const base = slugify(input.slug);
    let slug = base;
    let suffix = 2;
    while (await db.tvChannel.findFirst({ where: { slug, NOT: { id: existing.id } }, select: { id: true } })) {
      slug = `${base}-${suffix++}`;
    }
    input.slug = slug;
  }

  const row = await db.tvChannel.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      groupName: input.groupName,
      streamUrl: input.streamUrl,
      logoUrl: input.logoUrl === undefined ? undefined : input.logoUrl,
      previewUrl: input.previewUrl === undefined ? undefined : input.previewUrl,
      slug: input.slug,
      status: input.status,
      sortOrder: input.sortOrder,
      isFeatured: input.isFeatured,
    },
  });

  return NextResponse.json({
    data: {
      id: row.slug,
      name: row.name,
      group: row.groupName,
      logo: row.logoUrl,
      url: row.streamUrl,
      tvgId: row.id,
      previewUrl: row.previewUrl,
      isFeatured: row.isFeatured,
    },
  });
}

/** DELETE /api/v1/channels/:id — hides a channel instead of destroying history. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(ROLES.SUPER_ADMIN);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await findChannel(id);
  if (!existing) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Channel not found." } },
      { status: 404 },
    );
  }

  await db.tvChannel.update({
    where: { id: existing.id },
    data: { status: "hidden" },
  });

  return NextResponse.json({ data: { id: existing.slug, hidden: true } });
}
