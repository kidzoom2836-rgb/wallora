import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { posts, likes, profiles } from "@wallora/database";
import { eq, desc, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: posts.id,
      caption: posts.caption,
      imageUrl: posts.imageUrl,
      createdAt: posts.createdAt,
      userId: posts.userId,
      username: profiles.username,
      displayName: profiles.displayName,
    })
    .from(posts)
    .leftJoin(profiles, eq(profiles.userId, posts.userId))
    .orderBy(desc(posts.createdAt));

  // attach like counts
  const likeCounts = await db
    .select({ postId: likes.postId, count: sql<number>`count(*)::int` })
    .from(likes)
    .groupBy(likes.postId);
  const lcMap = new Map(likeCounts.map((l) => [l.postId, l.count]));

  const myLikes = await db.select({ postId: likes.postId }).from(likes).where(eq(likes.userId, session.user.id));
  const mySet = new Set(myLikes.map((l) => l.postId));

  const result = rows.map((r) => ({
    ...r,
    likeCount: lcMap.get(r.id) ?? 0,
    likedByMe: mySet.has(r.id),
  }));

  return NextResponse.json({ posts: result });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const caption = typeof body?.caption === "string" ? body.caption : null;
  const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : null;

  const [row] = await db
    .insert(posts)
    .values({ id: randomUUID(), userId: session.user.id, caption, imageUrl })
    .returning();

  return NextResponse.json({ post: row }, { status: 201 });
}
