import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAuthSession, requireUser } from "@/lib/auth-helpers";
import { getTier } from "@/lib/verification/store";

/**
 * GET /api/v1/auth/me
 * Returns the current authenticated user + profile, or 401 if not signed in.
 */
export async function GET() {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const userId = result.session.user.id;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      status: true,
      emailVerified: true,
      createdAt: true,
      profile: {
        select: {
          username: true,
          displayName: true,
          bio: true,
          avatarUrl: true,
          coverUrl: true,
          verified: true,
          creatorStatus: true,
        },
      },
      settings: {
        select: {
          theme: true,
          emailNotifications: true,
          pushNotifications: true,
          aiPreferenceMode: true,
        },
      },
    },
  });

  if (!user || user.status !== "active") {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Authentication required." } },
      { status: 401 },
    );
  }

  const verificationTier = await getTier(userId);
  return NextResponse.json({ data: { ...user, verificationTier } });
}

/**
 * PATCH /api/v1/auth/me
 * Updates editable profile fields (displayName, bio). Username changes and
 * role changes are intentionally NOT allowed here.
 */
export async function PATCH(request: Request) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Authentication required." } },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const { z } = await import("zod");
  const UpdateSchema = z.object({
    displayName: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .optional(),
    bio: z
      .string()
      .trim()
      .max(500, { message: "Bio is too long" })
      .optional(),
  });

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: parsed.error.issues[0]?.message ?? "Invalid request.",
        },
      },
      { status: 400 },
    );
  }

  const { displayName, bio } = parsed.data;
  const data: { displayName?: string; bio?: string } = {};
  if (typeof displayName === "string") data.displayName = displayName;
  if (typeof bio === "string") data.bio = bio;

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "No updatable fields provided." } },
      { status: 400 },
    );
  }

  const updated = await db.profile.update({
    where: { userId: session.user.id },
    data,
    select: { username: true, displayName: true, bio: true },
  });

  return NextResponse.json({ data: updated });
}
