import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { wallpapers, categories, wallpaperLikes } from "@wallora/database";
import { eq, desc, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(wallpapers)
    .where(eq(wallpapers.status, "approved"))
    .orderBy(desc(wallpapers.createdAt));

  const myLikes = await db.select({ wallpaperId: wallpaperLikes.wallpaperId }).from(wallpaperLikes).where(eq(wallpaperLikes.userId, session.user.id));
  const mySet = new Set(myLikes.map((l) => l.wallpaperId));

  const result = rows.map((r) => ({ ...r, likedByMe: mySet.has(r.id) }));
  return NextResponse.json({ wallpapers: result });
}
