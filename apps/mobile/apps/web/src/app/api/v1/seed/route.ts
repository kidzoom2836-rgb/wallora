import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { wallpapers, categories } from "@wallora/database";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Seed categories
  const cats = [
    { name: "Nature", slug: "nature" },
    { name: "Technology", slug: "technology" },
    { name: "Architecture", slug: "architecture" },
    { name: "Abstract", slug: "abstract" },
    { name: "Minimalism", slug: "minimalism" },
  ];
  for (const c of cats) {
    try {
      await db.insert(categories).values({ id: randomUUID(), name: c.name, slug: c.slug }).onConflictDoNothing();
    } catch {}
  }

  const catRows = await db.select().from(categories);
  const catMap = new Map(catRows.map((c) => [c.slug, c.id]));

  const samples = [
    { title: "Cosmic Horizon", cat: "abstract", w: 1920, h: 1080 },
    { title: "Urban Minimal", cat: "architecture", w: 1080, h: 1920 },
    { title: "Forest Dawn", cat: "nature", w: 1920, h: 1080 },
    { title: "Neon City", cat: "technology", w: 1080, h: 1920 },
    { title: "Clean Space", cat: "minimalism", w: 1920, h: 1080 },
    { title: "Aurora Sky", cat: "nature", w: 1080, h: 1920 },
    { title: "Glass Tower", cat: "architecture", w: 1920, h: 1080 },
    { title: "Digital Wave", cat: "technology", w: 1080, h: 1920 },
  ];

  let inserted = 0;
  for (const s of samples) {
    const id = `wp-${s.title.toLowerCase().replace(/\s+/g, "-")}`;
    const existing = await db.select().from(wallpapers).where(eq(wallpapers.id, id));
    if (existing.length > 0) continue;
    await db.insert(wallpapers).values({
      id,
      title: s.title,
      description: `A beautiful ${s.cat} wallpaper for your device.`,
      imageUrl: `https://picsum.photos/seed/${s.title.replace(/\s/g, "")}/${s.w}/${s.h}`,
      thumbnailUrl: `https://picsum.photos/seed/${s.title.replace(/\s/g, "")}/400/600`,
      creatorId: session.user.id,
      categoryId: catMap.get(s.cat) ?? null,
      width: s.w,
      height: s.h,
      format: "jpeg",
      status: "approved",
    });
    inserted++;
  }

  return NextResponse.json({ ok: true, inserted });
}
