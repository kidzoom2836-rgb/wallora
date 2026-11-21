import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth-helpers";

/**
 * POST /api/v1/wallpapers/[slug]/download
 *
 * Records a download event (append-only) and returns the original asset URL
 * for the client to fetch. Auth-aware: links the event to the user if signed
 * in, anonymous otherwise. Always increments the download counter atomically.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const session = await getAuthSession();
  const userId = session?.user?.id ?? null;

  const wallpaper = await db.wallpaper.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      status: true,
      isPublic: true,
      license: true,
      assets: {
        where: { variant: "original" },
        select: { objectKey: true, width: true, height: true, fileSize: true, format: true, mimeType: true },
        take: 1,
      },
    },
  });

  if (!wallpaper || wallpaper.status !== "approved" || !wallpaper.isPublic) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Wallpaper not found." } },
      { status: 404 },
    );
  }

  const asset = wallpaper.assets[0];
  if (!asset) {
    return NextResponse.json(
      { error: { code: "no_asset", message: "No downloadable asset is available." } },
      { status: 404 },
    );
  }

  // Record the download + increment counter atomically
  await db.$transaction([
    db.wallpaperDownload.create({
      data: {
        wallpaperId: wallpaper.id,
        userId,
        variant: "original",
      },
    }),
    db.wallpaper.update({
      where: { id: wallpaper.id },
      data: { downloadCount: { increment: 1 } },
    }),
  ]);

  return NextResponse.json({
    data: {
      url: asset.objectKey,
      filename: `${slug}.${asset.format}`,
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
      mimeType: asset.mimeType,
      license: wallpaper.license,
    },
  });
}
