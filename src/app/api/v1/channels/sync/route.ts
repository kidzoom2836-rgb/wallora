import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRole, ROLES } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { isAllowedPlaylistUrl, parseM3U } from "@/lib/tv/m3u";

export const dynamic = "force-dynamic";

const SyncSchema = z.object({
  sourceUrl: z.string().trim().url(),
  sourceName: z.string().trim().min(1).max(120).default("M3U playlist"),
  dryRun: z.boolean().default(false),
});

const DEFAULT_SOURCE = "https://raw.githubusercontent.com/nn2wdw5jvc-max/mu-iptv/main/EDEM_2.m3u";

/** POST /api/v1/channels/sync — import a public M3U guide into the database. */
export async function POST(request: NextRequest) {
  const auth = await requireRole(ROLES.SUPER_ADMIN);
  if (!auth.ok) return auth.response;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const parsed = SyncSchema.safeParse(
    body && typeof body === "object" && !Array.isArray(body)
      ? { sourceUrl: DEFAULT_SOURCE, ...(body as Record<string, unknown>) }
      : { sourceUrl: DEFAULT_SOURCE },
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: parsed.error.issues[0]?.message ?? "Invalid sync request.",
        },
      },
      { status: 400 },
    );
  }

  const { sourceUrl, sourceName, dryRun } = parsed.data;
  if (!isAllowedPlaylistUrl(sourceUrl)) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Only public HTTPS M3U playlists from GitHub/GitHub Pages are allowed.",
        },
      },
      { status: 400 },
    );
  }

  let playlist: Response;
  try {
    playlist = await fetch(sourceUrl, {
      headers: { Accept: "application/vnd.apple.mpegurl,text/plain,*/*" },
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: { code: "upstream_error", message: "Could not reach that playlist." } },
      { status: 502 },
    );
  }

  if (!playlist.ok) {
    return NextResponse.json(
      { error: { code: "upstream_error", message: `Playlist returned ${playlist.status}.` } },
      { status: 502 },
    );
  }

  const channels = parseM3U(await playlist.text());
  if (channels.length === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "No channels found in that playlist." } },
      { status: 400 },
    );
  }

  if (dryRun) {
    return NextResponse.json({
      data: { dryRun: true, count: channels.length, sample: channels.slice(0, 10) },
    });
  }

  const source = await db.tvPlaylistSource.upsert({
    where: { url: sourceUrl },
    update: { name: sourceName, enabled: true, lastError: null, lastSyncedAt: new Date(), lastChannelCount: channels.length },
    create: { name: sourceName, url: sourceUrl, lastSyncedAt: new Date(), lastChannelCount: channels.length },
  });

  let created = 0;
  let updated = 0;
  for (let index = 0; index < channels.length; index += 1) {
    const channel = channels[index];
    const existing = await db.tvChannel.findUnique({ where: { slug: channel.slug } });
    const data = {
      name: channel.name,
      groupName: channel.groupName,
      logoUrl: channel.logoUrl,
      streamUrl: channel.streamUrl,
      status: "active",
      sortOrder: index,
      createdById: auth.session.user.id,
    };
    if (existing) {
      await db.tvChannel.update({ where: { slug: channel.slug }, data: { ...data, createdById: undefined } });
      updated += 1;
    } else {
      await db.tvChannel.create({ data });
      created += 1;
    }
  }

  return NextResponse.json({
    data: { sourceId: source.id, total: channels.length, created, updated, source: sourceUrl },
    message: `Synced ${channels.length} channels from ${sourceName}.`,
  });
}

/** GET /api/v1/channels/sync — show the default source and sync history. */
export async function GET() {
  const auth = await requireRole(ROLES.SUPER_ADMIN);
  if (!auth.ok) return auth.response;

  const sources = await db.tvPlaylistSource.findMany({ orderBy: { updatedAt: "desc" }, take: 20 });
  return NextResponse.json({ data: { defaultSource: DEFAULT_SOURCE, sources } });
}
