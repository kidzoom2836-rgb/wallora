import { NextRequest, NextResponse } from "next/server";

import { requireVerification } from "@/lib/auth-helpers";
import { getStoredPost, setLike } from "@/lib/community/store";

export const dynamic = "force-dynamic";

function notFound() {
  return NextResponse.json(
    { error: { code: "not_found", message: "Post not found." } },
    { status: 404 },
  );
}

/** POST /api/v1/community/posts/[id]/like — idempotent like. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireVerification();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!(await getStoredPost(id))) return notFound();

  const result = await setLike(id, auth.session.user.id, true);
  if (!result) return notFound();
  return NextResponse.json({ data: result });
}

/** DELETE /api/v1/community/posts/[id]/like — remove like (idempotent). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireVerification();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!(await getStoredPost(id))) return notFound();

  const result = await setLike(id, auth.session.user.id, false);
  if (!result) return notFound();
  return NextResponse.json({ data: result });
}
