import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireVerification } from "@/lib/auth-helpers";
import { addComment, getAuthorSnapshot, getStoredPost, listComments } from "@/lib/community/store";

export const dynamic = "force-dynamic";

const CommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, { message: "Comment cannot be empty." })
    .max(500, { message: "Comment must be 500 characters or fewer." }),
});

function notFound() {
  return NextResponse.json(
    { error: { code: "not_found", message: "Post not found." } },
    { status: 404 },
  );
}

/** GET /api/v1/community/posts/[id]/comments — public comment thread. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await getStoredPost(id))) return notFound();
  const items = await listComments(id);
  return NextResponse.json({ data: { items, total: items.length, limit: 50 } });
}

/** POST /api/v1/community/posts/[id]/comments — verified users only. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireVerification();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!(await getStoredPost(id))) return notFound();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }
  if (!raw || typeof raw !== "object") {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid comment." } },
      { status: 400 },
    );
  }

  const record = raw as Record<string, unknown>;
  const parsed = CommentSchema.safeParse({ content: record.content ?? record.body });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: parsed.error.issues[0]?.message ?? "Invalid comment.",
        },
      },
      { status: 400 },
    );
  }

  const sessionUser = auth.session.user;
  const author = await getAuthorSnapshot(sessionUser.id, {
    username: sessionUser.username,
    displayName: sessionUser.name,
    avatarUrl: sessionUser.image,
  });
  const comment = await addComment(id, parsed.data.content, author);
  if (!comment) return notFound();

  return NextResponse.json({ data: comment }, { status: 201 });
}
