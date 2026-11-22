import { NextRequest, NextResponse } from "next/server";

import { buildShowroomPayloads, getShowroom } from "@/lib/showroom/store";

export const dynamic = "force-dynamic";

/** GET /api/v1/showroom/[username] — full showroom with resolved real items. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const showroom = await getShowroom(username);
  if (!showroom) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Showroom not found." } },
      { status: 404 },
    );
  }

  const payload = (await buildShowroomPayloads([showroom]))[0];
  if (!payload) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Showroom not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: payload });
}
