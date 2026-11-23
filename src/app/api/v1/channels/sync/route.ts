import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRole, ROLES } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { isAllowedPlaylistUrl, parseM3U } from "@/lib/tv/m3u";

export const dynamic = "force-dynamic";
// Large public guides (iptv-org has ~11.5k channels) need more than the
// default serverless execution window.
export const maxDuration = 300;

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
  const existingRows = await db.tvChannel.findMany({
    where: { slug: { in: channels.map((channel) => channel.slug) } },
    select: { slug: true },
  });
  const existingSlugs = new Set(existingRows.map((row) => row.slug));

  // Chunked upserts keep a full 10k+ channel sync inside a serverless window
  // instead of issuing two sequential queries per channel.
  const BATCH_SIZE = 100;
  for (let offset = 0; offset < channels.length; offset += BATCH_SIZE) {
    const batch = channels.slice(offset, offset + BATCH_SIZE);
    await db.$transaction(
      batch.map((channel, index) => {
        const sortOrder = offset + index;
        const wasExisting = existingSlugs.has(channel.slug);
        if (wasExisting) updated += 1;
        else created += 1;
        const data = {
          name: channel.name,
          groupName: channel.groupName,
          logoUrl: channel.logoUrl,
          streamUrl: channel.streamUrl,
          status: "active",
          sortOrder,
        };
        return db.tvChannel.upsert({
          where: { slug: channel.slug },
          create: { ...data, createdById: auth.session.user.id },
          update: data,
        });
      }),
    );
  }

  return NextResponse.json({
    data: { sourceId: source.id, total: channels.length, created, updated, source: sourceUrl },
    message: `Synced ${channels.length} channels from ${sourceName}.`,
  });
}

/**
 * Curated, credential-free iptv-org playlists. Small subsets are recommended
 * over the 11.5k-channel index because most users only need a few regions and
 * categories, and dead/geo-blocked links are easier to spot in a smaller set.
 */
export const RECOMMENDED_SOURCES = [
  { name: "iptv-org · Kenya", url: "https://iptv-org.github.io/iptv/countries/ke.m3u" },
  { name: "iptv-org · News", url: "https://iptv-org.github.io/iptv/categories/news.m3u" },
  { name: "iptv-org · Sports", url: "https://iptv-org.github.io/iptv/categories/sports.m3u" },
  { name: "iptv-org · Movies", url: "https://iptv-org.github.io/iptv/categories/movies.m3u" },
  { name: "iptv-org · Kids", url: "https://iptv-org.github.io/iptv/categories/kids.m3u" },
  { name: "iptv-org · All channels", url: "https://iptv-org.github.io/iptv/index.m3u" },
] as const;

/** GET /api/v1/channels/sync — show the default source and sync history. */
export async function GET() {
  const auth = await requireRole(ROLES.SUPER_ADMIN);
  if (!auth.ok) return auth.response;

  const sources = await db.tvPlaylistSource.findMany({ orderBy: { updatedAt: "desc" }, take: 20 });
  return NextResponse.json({
    data: { defaultSource: DEFAULT_SOURCE, recommendedSources: RECOMMENDED_SOURCES, sources },
  });
}
