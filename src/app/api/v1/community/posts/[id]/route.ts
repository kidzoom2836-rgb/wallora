import { NextRequest, NextResponse } from "next/server";

import { getAuthSession, hasRole, requireVerification } from "@/lib/auth-helpers";
import { deletePost, getPost } from "@/lib/community/store";

export const dynamic = "force-dynamic";

/** GET /api/v1/community/posts/[id] — single post with viewer state. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getAuthSession();
  const post = await getPost(id, session?.user?.id ?? null);
  if (!post) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Post not found." } },
      { status: 404 },
    );
  }
  return NextResponse.json({ data: post });
}

/** DELETE /api/v1/community/posts/[id] — author or super_admin only. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireVerification();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const sessionUser = auth.session.user;
  const post = await getPost(id, sessionUser.id);
  if (!post) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Post not found." } },
      { status: 404 },
    );
  }

  const allowed =
    post.author.id === sessionUser.id || hasRole(sessionUser.role, "super_admin");
  if (!allowed) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "You cannot delete this post." } },
      { status: 403 },
    );
  }

  await deletePost(id);
  return NextResponse.json({ data: { id, deleted: true } });
}
