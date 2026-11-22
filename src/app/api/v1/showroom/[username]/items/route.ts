import { NextRequest, NextResponse } from "next/server";

import { requireVerification } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import {
  addShowroomItem,
  buildShowroomPayloads,
  getShowroom,
  normalizeUsername,
  removeShowroomItem,
  validateShowroomItems,
} from "@/lib/showroom/store";

export const dynamic = "force-dynamic";

function error(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function ownUsername(sessionUserId: string, sessionUsername?: string | null): Promise<string | null> {
  const fromSession = normalizeUsername(sessionUsername);
  if (fromSession) {
    const profile = await db.profile.findFirst({
      where: { userId: sessionUserId, username: fromSession },
      select: { username: true },
    });
    if (profile) return profile.username;
  }
  const profile = await db.profile.findUnique({
    where: { userId: sessionUserId },
    select: { username: true },
  });
  return normalizeUsername(profile?.username) || null;
}

async function respond(showroom: Awaited<ReturnType<typeof addShowroomItem>>, status = 200) {
  if (!showroom) return error("not_found", "Showroom not found.", 404);
  const payload = (await buildShowroomPayloads([showroom]))[0];
  if (!payload) return error("not_found", "Showroom not found.", 404);
  return NextResponse.json({ data: payload }, { status });
}

/**
 * POST /api/v1/showroom/[username]/items
 * Add a real wallpaper/project reference to the caller's own showroom.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const auth = await requireVerification();
  if (!auth.ok) return auth.response;

  const { username } = await params;
  const target = normalizeUsername(username);
  const mine = await ownUsername(auth.session.user.id, auth.session.user.username);
  if (!mine || mine !== target) return error("not_found", "Showroom not found.", 404);

  // Legacy showrooms may not have an explicit owner — refuse them here rather
  // than letting an unrelated account adopt an editorial gallery.
  const existing = await getShowroom(target);
  if (existing?.userId && existing.userId !== auth.session.user.id) {
    return error("not_found", "Showroom not found.", 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("validation_error", "Invalid JSON body.", 400);
  }
  const raw = (body as { item?: unknown; items?: unknown } | null)?.item ?? (body as { items?: unknown } | null)?.items ?? body;
  const checked = await validateShowroomItems(Array.isArray(raw) ? raw : [raw], auth.session.user.id);
  if (!checked.ok || checked.items.length !== 1) {
    return error("validation_error", checked.ok ? "Exactly one item is required." : checked.error, 400);
  }

  return respond(await addShowroomItem(auth.session.user.id, target, checked.items[0]), 201);
}

/** DELETE /api/v1/showroom/[username]/items?id=... — remove one item. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const auth = await requireVerification();
  if (!auth.ok) return auth.response;

  const { username } = await params;
  const target = normalizeUsername(username);
  const mine = await ownUsername(auth.session.user.id, auth.session.user.username);
  if (!mine || mine !== target) return error("not_found", "Showroom not found.", 404);

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return error("bad_request", "id is required.", 400);

  const showroom = await removeShowroomItem(auth.session.user.id, target, id);
  return respond(showroom);
}
