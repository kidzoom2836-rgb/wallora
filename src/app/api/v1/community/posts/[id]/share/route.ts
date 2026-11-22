import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireVerification } from "@/lib/auth-helpers";
import { getStoredPost, incrementShare } from "@/lib/community/store";

export const dynamic = "force-dynamic";

const ShareSchema = z.object({
  platform: z.enum([
    "whatsapp",
    "instagram",
    "tiktok",
    "facebook",
    "snapchat",
    "copy",
  ]),
});

/** POST /api/v1/community/posts/[id]/share — count a share, return canonical URL. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireVerification();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!(await getStoredPost(id))) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Post not found." } },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }
  const parsed = ShareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Choose a supported sharing platform.",
        },
      },
      { status: 400 },
    );
  }

  const shareCount = await incrementShare(id);
  if (shareCount === null) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Post not found." } },
      { status: 404 },
    );
  }

  const requestUrl = new URL(request.url);
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    requestUrl.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host");
  const origin = host ? `${proto}://${host}` : requestUrl.origin;
  const shareUrl = `${origin}/community?post=${encodeURIComponent(id)}`;

  return NextResponse.json({ data: { shareCount, shareUrl } });
}
