import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireVerification, isValidUsername } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import {
  buildShowroomPayloads,
  getShowroom,
  listShowrooms,
  normalizeUsername,
  upsertShowroom,
  validateShowroomItems,
} from "@/lib/showroom/store";

export const dynamic = "force-dynamic";

const ShowroomBodySchema = z.object({
  headline: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  items: z.array(z.object({
    id: z.string().trim().max(120).optional(),
    wallpaperSlug: z.string().trim().max(200).optional().nullable(),
    projectId: z.string().trim().max(100).optional().nullable(),
    imageUrl: z.string().trim().max(2048).optional().nullable(),
    caption: z.string().trim().max(200).optional(),
    createdAt: z.string().trim().max(40).optional(),
  })).max(50),
});

function error(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * GET /api/v1/showroom?q=&page=&limit=
 *
 * Lists curated showrooms. Each card carries an owner snapshot (username,
 * displayName, avatarUrl, tier), its real item count and up to four resolved
 * items. The editors showroom is seeded from approved wallpapers on first use.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().slice(0, 80).toLowerCase() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(36, Math.max(1, parseInt(searchParams.get("limit") ?? "18", 10) || 18));

  const all = await listShowrooms();
  const matching = q
    ? all.filter((s) =>
        `${s.username} ${s.headline} ${s.description}`.toLowerCase().includes(q),
      )
    : all;

  const payloads = await buildShowroomPayloads(matching, 4);
  const filtered = q
    ? payloads.filter((s) =>
        `${s.username} ${s.headline} ${s.description} ${s.owner.displayName ?? ""}`
          .toLowerCase()
          .includes(q),
      )
    : payloads;
  const total = filtered.length;

  return NextResponse.json({
    data: {
      items: filtered.slice((page - 1) * limit, page * limit),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    },
  });
}

/**
 * POST /api/v1/showroom
 *
 * Create or update the caller's showroom. All item references are checked
 * against real records before they are stored.
 */
export async function POST(request: NextRequest) {
  const auth = await requireVerification();
  if (!auth.ok) return auth.response;

  const userId = auth.session.user.id;
  let name = normalizeUsername(auth.session.user.username);
  if (!name || !isValidUsername(name)) {
    const profile = await db.profile.findUnique({
      where: { userId },
      select: { username: true },
    });
    name = normalizeUsername(profile?.username);
  }
  if (!name || !isValidUsername(name)) {
    return error("username_required", "Set a profile username before creating a showroom.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("validation_error", "Invalid JSON body.", 400);
  }
  const parsed = ShowroomBodySchema.safeParse(body);
  if (!parsed.success) {
    return error("validation_error", parsed.error.issues[0]?.message ?? "Invalid request.", 400);
  }

  const checked = await validateShowroomItems(parsed.data.items, userId);
  if (!checked.ok) return error("validation_error", checked.error, 400);

  const existing = await getShowroom(name);
  const showroom = await upsertShowroom(userId, name, {
    headline: parsed.data.headline,
    description: parsed.data.description,
    items: checked.items,
  });
  if (!showroom) return error("conflict", "That showroom belongs to another creator.", 409);

  const payload = (await buildShowroomPayloads([showroom]))[0];
  if (!payload) return error("profile_required", "A public profile is required for a showroom.", 400);
  return NextResponse.json({ data: payload }, { status: existing ? 200 : 201 });
}
