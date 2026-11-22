import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { comments, profiles } from "@wallora/database";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      userId: comments.userId,
      username: profiles.username,
    })
    .from(comments)
    .leftJoin(profiles, eq(profiles.userId, comments.userId))
    .where(eq(comments.postId, id))
    .orderBy(desc(comments.createdAt));

  return NextResponse.json({ comments: rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "Body required" }, { status: 400 });

  const [row] = await db
    .insert(comments)
    .values({ id: randomUUID(), userId: session.user.id, postId: id, body: text })
    .returning();

  return NextResponse.json({ comment: row }, { status: 201 });
}
