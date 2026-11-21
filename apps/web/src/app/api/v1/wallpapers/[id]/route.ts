import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { wallpapers, wallpaperLikes, wallpaperDownloads } from "@wallora/database";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const rows = await db.select().from(wallpapers).where(eq(wallpapers.id, id));
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const myLikes = await db.select().from(wallpaperLikes).where(eq(wallpaperLikes.wallpaperId, id));
  const likedByMe = myLikes.some((l) => l.userId === session.user.id);

  return NextResponse.json({ wallpaper: { ...rows[0], likedByMe } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  if (body.action === "like") {
    const existing = await db.select().from(wallpaperLikes).where(eq(wallpaperLikes.wallpaperId, id));
    const mine = existing.find((l) => l.userId === session.user.id);
    if (mine) {
      await db.delete(wallpaperLikes).where(eq(wallpaperLikes.id, mine.id));
      await db.update(wallpapers).set({ likes: sql`likes - 1` }).where(eq(wallpapers.id, id));
      return NextResponse.json({ liked: false });
    }
    await db.insert(wallpaperLikes).values({ id: randomUUID(), userId: session.user.id, wallpaperId: id });
    await db.update(wallpapers).set({ likes: sql`likes + 1` }).where(eq(wallpapers.id, id));
    return NextResponse.json({ liked: true });
  }

  if (body.action === "download") {
    await db.insert(wallpaperDownloads).values({ id: randomUUID(), userId: session.user.id, wallpaperId: id });
    await db.update(wallpapers).set({ downloads: sql`downloads + 1` }).where(eq(wallpapers.id, id));
    const rows = await db.select().from(wallpapers).where(eq(wallpapers.id, id));
    return NextResponse.json({ url: rows[0]?.imageUrl, downloads: rows[0]?.downloads });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
