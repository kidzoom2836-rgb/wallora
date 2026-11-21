import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { likes } from "@wallora/database";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await db.select().from(likes).where(and(eq(likes.userId, session.user.id), eq(likes.postId, id)));
  if (existing.length > 0) {
    await db.delete(likes).where(and(eq(likes.userId, session.user.id), eq(likes.postId, id)));
    return NextResponse.json({ liked: false });
  }
  await db.insert(likes).values({ id: randomUUID(), userId: session.user.id, postId: id });
  return NextResponse.json({ liked: true });
}
