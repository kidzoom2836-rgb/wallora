import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creativeProjects } from "@wallora/database";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(creativeProjects)
    .where(eq(creativeProjects.userId, session.user.id))
    .orderBy(desc(creativeProjects.updatedAt));

  return NextResponse.json({ projects: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "Untitled project";

  const [row] = await db
    .insert(creativeProjects)
    .values({
      id: randomUUID(),
      userId: session.user.id,
      name,
      description: typeof body?.description === "string" ? body.description : null,
      visibility: body?.visibility === "public" ? "public" : "private",
    })
    .returning();

  return NextResponse.json({ project: row }, { status: 201 });
}
