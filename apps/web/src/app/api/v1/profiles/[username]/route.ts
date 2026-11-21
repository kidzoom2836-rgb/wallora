import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles, userRoles } from "@wallora/database";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { username } = await params;

  const rows = await db.select().from(profiles).where(eq(profiles.username, username));
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const roleRows = await db.select().from(userRoles).where(eq(userRoles.userId, rows[0].userId));
  return NextResponse.json({ profile: rows[0], role: roleRows[0]?.role ?? "user" });
}
