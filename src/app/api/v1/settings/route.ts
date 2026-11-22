import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const SettingsSchema = z.object({
  theme: z.enum(["dark", "light", "system"]).optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  aiPreferenceMode: z
    .enum(["creative-assistant", "precise", "concise", "collaborative"])
    .optional(),
  preferredImageStyles: z.string().trim().max(500).optional(),
  preferredCategories: z.string().trim().max(500).optional(),
});

async function ensureSettings(userId: string) {
  return db.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: {
      theme: true,
      emailNotifications: true,
      pushNotifications: true,
      aiPreferenceMode: true,
      preferredImageStyles: true,
      preferredCategories: true,
    },
  });
}

/** GET /api/v1/settings — the signed-in user's application settings. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ data: await ensureSettings(auth.session.user.id) });
}

/** PATCH /api/v1/settings — update application preferences. */
export async function PATCH(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const parsed = SettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: parsed.error.issues[0]?.message ?? "Invalid settings.",
        },
      },
      { status: 400 },
    );
  }

  await ensureSettings(auth.session.user.id);
  const updated = await db.userSettings.update({
    where: { userId: auth.session.user.id },
    data: parsed.data,
    select: {
      theme: true,
      emailNotifications: true,
      pushNotifications: true,
      aiPreferenceMode: true,
      preferredImageStyles: true,
      preferredCategories: true,
    },
  });

  return NextResponse.json({ data: updated, message: "Settings saved." });
}
