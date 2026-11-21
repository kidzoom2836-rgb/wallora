import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/v1/storage/{key}
 *
 * Serves a stored blob directly from the Postgres StoredBlob table. This is
 * the public URL used by the DatabaseStorageAdapter — img src tags point here.
 *
 * Responses are cached immutably for 1 year (the content never changes for a
 * given key), so the browser only hits the database once per image.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await params;
  const key = segments.join("/");

  const blob = await db.storedBlob.findUnique({
    where: { key },
    select: { data: true, contentType: true },
  });

  if (!blob) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(Buffer.from(blob.data), {
    headers: {
      "Content-Type": blob.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
