import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import {
  isExpoPushToken,
  listUserTokens,
  registerPushToken,
  removePushToken,
} from "@/lib/push/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TokenSchema = z.object({
  token: z.string().trim().min(10).max(256),
  platform: z.enum(["android", "ios", "web"]).optional(),
});

/** GET /api/v1/push/tokens — registration state for the signed-in user. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const [tokens, settings] = await Promise.all([
    listUserTokens(auth.session.user.id),
    db.userSettings.findUnique({
      where: { userId: auth.session.user.id },
      select: { pushNotifications: true },
    }),
  ]);

  return NextResponse.json({
    data: { enabled: !!settings?.pushNotifications, deviceCount: tokens.length },
  });
}

/** POST /api/v1/push/tokens — register (or refresh) this device's Expo token. */
export async function POST(request: NextRequest) {
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

  const parsed = TokenSchema.safeParse(body);
  if (!parsed.success || !isExpoPushToken(parsed.data?.token)) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "A valid Expo push token is required." } },
      { status: 400 },
    );
  }

  const deviceCount = await registerPushToken(
    auth.session.user.id,
    parsed.data.token,
    parsed.data.platform,
  );
  await db.userSettings.upsert({
    where: { userId: auth.session.user.id },
    update: { pushNotifications: true },
    create: { userId: auth.session.user.id, pushNotifications: true },
  });

  return NextResponse.json({ data: { registered: true, deviceCount } });
}

/** DELETE /api/v1/push/tokens — opt this device out. */
export async function DELETE(request: NextRequest) {
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

  const parsed = TokenSchema.partial({ platform: true }).safeParse(body);
  if (!parsed.success || !parsed.data?.token) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "A push token is required." } },
      { status: 400 },
    );
  }

  const deviceCount = await removePushToken(auth.session.user.id, parsed.data.token);
  if (deviceCount === 0) {
    await db.userSettings.updateMany({
      where: { userId: auth.session.user.id },
      data: { pushNotifications: false },
    });
  }

  return NextResponse.json({ data: { registered: false, deviceCount } });
}
