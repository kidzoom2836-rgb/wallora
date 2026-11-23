import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/v1/storage/{key}
 *
 * Serves a stored blob directly from the Postgres StoredBlob table. This is
 * the public URL used by the DatabaseStorageAdapter and by WALLORA TV preview
 * clips. HTTP Range requests return 206 so video players can seek instead of
 * downloading the whole file first.
 */
export const dynamic = "force-dynamic";

function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header || size <= 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return null;

  let start: number;
  let end: number;
  if (!match[1]) {
    const suffix = Number.parseInt(match[2], 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number.parseInt(match[1], 10);
    end = match[2] ? Number.parseInt(match[2], 10) : size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

async function loadBlob(key: string) {
  return db.storedBlob.findUnique({
    where: { key },
    select: { data: true, contentType: true },
  });
}

function baseHeaders(contentType: string) {
  return {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await params;
  const key = segments.join("/");

  const blob = await loadBlob(key);
  if (!blob) {
    return new NextResponse("Not found", { status: 404 });
  }

  const bytes = Buffer.from(blob.data);
  const range = parseRange(request.headers.get("range"), bytes.length);

  if (range) {
    const chunk = bytes.subarray(range.start, range.end + 1);
    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        ...baseHeaders(blob.contentType),
        "Content-Range": `bytes ${range.start}-${range.end}/${bytes.length}`,
        "Content-Length": String(chunk.length),
      },
    });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      ...baseHeaders(blob.contentType),
      "Content-Length": String(bytes.length),
    },
  });
}

export async function HEAD(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await params;
  const blob = await loadBlob(segments.join("/"));
  if (!blob) {
    return new NextResponse(null, { status: 404 });
  }
  const size = Buffer.from(blob.data).length;
  return new NextResponse(null, {
    headers: {
      ...baseHeaders(blob.contentType),
      "Content-Length": String(size),
    },
  });
}
