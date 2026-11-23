import { spawnSync } from "child_process";
import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireVerification } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/** Capture a short preview directly from a live channel's HLS stream. */
const MIN_DURATION = 3;
const DEFAULT_DURATION = 9;
const MAX_DURATION = 15;
const MAX_CLIP_BYTES = 12 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

const CaptureSchema = z.object({
  channelId: z.string().trim().max(200).optional(),
  streamUrl: z
    .string()
    .trim()
    .url()
    .max(1000)
    .refine((value) => /^https?:\/\//i.test(value), "Stream URL must be HTTP(S)."),
  durationSec: z.number().int().min(MIN_DURATION).max(MAX_DURATION).default(DEFAULT_DURATION),
});

type Segment = { uri: string; duration: number };

function badRequest(message: string, status = 400) {
  return NextResponse.json(
    { error: { code: "clip_capture_error", message } },
    { status },
  );
}

/** Block loopback/private targets so a post cannot probe the server network. */
function isPublicHttpUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(url.protocol)) return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    !host.includes(".")
  ) {
    return false;
  }
  return true;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/vnd.apple.mpegurl,text/plain,*/*" },
  });
  if (!response.ok) throw new Error(`Playlist request failed (${response.status}).`);
  return response.text();
}

function resolveUrl(base: string, value: string): string {
  return new URL(value, base).toString();
}

/** Parse an HLS playlist, following a master playlist to its first variant. */
async function resolveMediaPlaylist(streamUrl: string): Promise<{ url: string; segments: Segment[] }> {
  let playlistUrl = streamUrl;
  let text = await fetchText(playlistUrl);
  const lines = text.split(/\r?\n/).map((line) => line.trim());

  if (lines.some((line) => line.startsWith("#EXT-X-STREAM-INF"))) {
    const variantIndex = lines.findIndex(
      (line, index) =>
        !line.startsWith("#") &&
        index > 0 &&
        lines[index - 1]?.startsWith("#EXT-X-STREAM-INF"),
    );
    if (variantIndex < 0) throw new Error("This stream has no playable variant.");
    playlistUrl = resolveUrl(playlistUrl, lines[variantIndex]);
    text = await fetchText(playlistUrl);
  }

  if (lines.some((line) => line.startsWith("#EXT-X-KEY:METHOD=AES-128"))) {
    throw new Error("This channel uses encrypted segments and cannot be clipped here.");
  }

  const sourceLines = text.split(/\r?\n/).map((line) => line.trim());
  const segments: Segment[] = [];
  let pendingDuration: number | null = null;

  for (const line of sourceLines) {
    if (line.startsWith("#EXTINF:")) {
      const raw = line.slice(8).split(",")[0];
      const parsed = Number.parseFloat(raw);
      pendingDuration = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      continue;
    }
    if (!line || line.startsWith("#")) continue;
    if (pendingDuration === null) continue;
    if (!isPublicHttpUrl(resolveUrl(playlistUrl, line))) continue;
    segments.push({ uri: resolveUrl(playlistUrl, line), duration: pendingDuration });
    pendingDuration = null;
  }

  if (!segments.length) throw new Error("No clippable segments were found in this stream.");
  return { url: playlistUrl, segments };
}

/** Choose the shortest tail of the live buffer that covers the requested duration. */
function selectTail(segments: Segment[], durationSec: number): Segment[] {
  const chosen: Segment[] = [];
  let total = 0;
  for (let i = segments.length - 1; i >= 0 && total < durationSec; i -= 1) {
    chosen.unshift(segments[i]);
    total += segments[i].duration;
  }
  return chosen.slice(-4);
}

async function fetchSegment(uri: string): Promise<Buffer> {
  const response = await fetch(uri, {
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "video/mp2t,video/*,*/*" },
  });
  if (!response.ok) throw new Error(`Segment request failed (${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error("A stream segment was empty.");
  return bytes;
}

function ffmpegAvailable(): boolean {
  const binary = process.env.WALLORA_FFMPEG_PATH ?? "ffmpeg";
  const result = spawnSync(binary, ["-version"], { encoding: "utf8", timeout: 3000 });
  return !result.error && result.status === 0;
}

/** Trim/remux with ffmpeg when the host provides it; otherwise keep the TS tail. */
async function normalizeClip(
  raw: Buffer,
  durationSec: number,
): Promise<{ bytes: Buffer; ext: "mp4" | "ts"; contentType: string }> {
  if (!ffmpegAvailable()) {
    return { bytes: raw, ext: "ts", contentType: "video/mp2t" };
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "wallora-clip-"));
  const input = path.join(workDir, "input.ts");
  const output = path.join(workDir, "clip.mp4");
  const binary = process.env.WALLORA_FFMPEG_PATH ?? "ffmpeg";
  try {
    await fs.writeFile(input, raw);
    const result = spawnSync(
      binary,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        input,
        "-t",
        String(durationSec),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "28",
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        "-movflags",
        "+faststart",
        "-y",
        output,
      ],
      { encoding: "utf8", timeout: 20_000 },
    );
    if (result.error || result.status !== 0) {
      return { bytes: raw, ext: "ts", contentType: "video/mp2t" };
    }
    const bytes = await fs.readFile(output);
    if (!bytes.length || bytes.length > MAX_CLIP_BYTES) {
      return { bytes: raw, ext: "ts", contentType: "video/mp2t" };
    }
    return { bytes, ext: "mp4", contentType: "video/mp4" };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** POST /api/v1/community/clips/capture — record a 9s preview from a live channel. */
export async function POST(request: NextRequest) {
  const auth = await requireVerification("free");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const parsed = CaptureSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid capture request.");
  }
  if (!isPublicHttpUrl(parsed.data.streamUrl)) {
    return badRequest("Only public HTTP(S) stream URLs can be clipped.");
  }

  try {
    const playlist = await resolveMediaPlaylist(parsed.data.streamUrl);
    const selected = selectTail(playlist.segments, parsed.data.durationSec);
    const parts: Buffer[] = [];
    for (const segment of selected) {
      parts.push(await fetchSegment(segment.uri));
    }
    const raw = Buffer.concat(parts);
    if (!raw.length) return badRequest("The channel did not return any video.");
    if (raw.length > MAX_CLIP_BYTES) {
      return badRequest("This channel's preview is too large. Try a lower-resolution channel.");
    }

    const clip = await normalizeClip(raw, parsed.data.durationSec);
    const storage = getStorage();
    const safeChannel = (parsed.data.channelId ?? "channel").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
    const key = `clips/${auth.session.user.id}/live-${safeChannel}-${crypto.randomUUID()}.${clip.ext}`;
    const stored = await storage.putObject(key, clip.bytes, clip.contentType);

    await db.auditLog.create({
      data: {
        actorId: auth.session.user.id,
        action: "community.clip.capture",
        targetType: "channel",
        targetId: parsed.data.channelId ?? key,
        metadata: JSON.stringify({
          key,
          source: playlist.url,
          segments: selected.length,
          durationSec: parsed.data.durationSec,
          size: stored.size,
          contentType: stored.contentType,
        }),
      },
    });

    return NextResponse.json(
      {
        data: {
          key: stored.key,
          videoUrl: storage.getPublicUrl(stored.key),
          contentType: stored.contentType,
          size: stored.size,
          durationSec: parsed.data.durationSec,
          source: "live-channel",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not capture this channel.";
    return badRequest(message, 502);
  }
}
