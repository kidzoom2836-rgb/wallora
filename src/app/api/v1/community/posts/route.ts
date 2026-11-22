import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession, requireVerification } from "@/lib/auth-helpers";
import {
  countPostsToday,
  createPost,
  getAuthorSnapshot,
  getStoredPost,
  listPosts,
} from "@/lib/community/store";
import { getTiersForUsers, TIER_LIMITS } from "@/lib/verification/store";

export const dynamic = "force-dynamic";

const CreatePostSchema = z
  .object({
    body: z
      .string()
      .trim()
      .max(2000, { message: "Posts must be 2000 characters or fewer." })
      .optional()
      .default(""),
    kind: z.enum(["text", "wallpaper", "project", "image"]).optional().default("text"),
    refId: z.string().trim().max(300).nullish(),
    /** Storage key returned by /api/v1/uploads/presign for direct image posts. */
    imageKey: z.string().trim().max(300).nullish(),
    repostOf: z.string().trim().max(200).nullish(),
  })
  .refine(
    (data) => data.body.length > 0 || (data.kind === "image" && !!(data.imageKey || data.refId)),
    { message: "Write something or attach an image before posting.", path: ["body"] },
  );

function badRequest(message: string) {
  return NextResponse.json(
    { error: { code: "validation_error", message } },
    { status: 400 },
  );
}

/** GET /api/v1/community/posts — public feed with optional viewer state. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 120);
  const sort = searchParams.get("sort") === "popular" ? "popular" : "recent";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10) || 12),
  );

  const session = await getAuthSession();
  const data = await listPosts({
    q,
    sort,
    page,
    limit,
    viewerId: session?.user?.id ?? null,
  });
  return NextResponse.json({ data });
}

/** POST /api/v1/community/posts — verified users only, capped per tier. */
export async function POST(request: NextRequest) {
  const auth = await requireVerification();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const parsed = CreatePostSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid post.");
  }

  const userId = auth.session.user.id;
  const tier = (await getTiersForUsers([userId]))[userId] ?? "free";
  const used = await countPostsToday(userId);
  const max = TIER_LIMITS[tier].postsPerDay;
  if (used >= max) {
    return NextResponse.json(
      {
        error: {
          code: "limit_reached",
          message: `Your ${tier} tier allows ${max} posts per day. Come back tomorrow.`,
        },
      },
      { status: 429 },
    );
  }

  const repostOf = parsed.data.repostOf?.trim() || null;
  if (repostOf && !(await getStoredPost(repostOf))) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Post to snap not found." } },
      { status: 404 },
    );
  }

  const author = await getAuthorSnapshot(userId, {
    username: auth.session.user.username,
    displayName: auth.session.user.name,
    avatarUrl: auth.session.user.image,
  });

  const imageKey =
    parsed.data.imageKey?.trim() ||
    (parsed.data.kind === "image" ? parsed.data.refId?.trim() : null) ||
    null;
  const kind = imageKey ? "image" : parsed.data.kind;

  const post = await createPost({
    body: parsed.data.body,
    kind,
    refId: kind === "image" ? imageKey : parsed.data.refId?.trim() || null,
    repostOf,
    author,
    ownerId: userId,
  });

  return NextResponse.json({ data: post }, { status: 201 });
}
