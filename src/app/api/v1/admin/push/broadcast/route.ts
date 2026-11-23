import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRole, ROLES } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { broadcastPush, sendPushToUsers } from "@/lib/push/send";
import { listPushEnabledUserIds } from "@/lib/push/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BroadcastSchema = z.object({
  title: z.string().trim().min(2).max(80),
  body: z.string().trim().min(2).max(240),
  url: z
    .string()
    .trim()
    .regex(/^\/(?!\/)/, "Deep link must start with a single /")
    .max(180)
    .optional(),
  audience: z.enum(["all", "selected"]).default("all"),
  userIds: z.array(z.string().min(1)).max(500).optional(),
});

/** GET /api/v1/admin/push/broadcast — safe diagnostics for the admin panel. */
export async function GET() {
  const auth = await requireRole(ROLES.SUPER_ADMIN);
  if (!auth.ok) return auth.response;

  const eligible = await listPushEnabledUserIds();
  return NextResponse.json({
    data: {
      eligibleUsers: eligible.length,
      accessTokenConfigured: !!process.env.EXPO_ACCESS_TOKEN,
    },
  });
}

/**
 * POST /api/v1/admin/push/broadcast
 * Announce a new feature, drop or wallpaper collection to opted-in devices.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(ROLES.SUPER_ADMIN);
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

  const parsed = BroadcastSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: parsed.error.issues[0]?.message ?? "Invalid broadcast payload.",
        },
      },
      { status: 400 },
    );
  }

  const { title, body: message, url, audience, userIds } = parsed.data;
  if (audience === "selected" && (!userIds || userIds.length === 0)) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Choose at least one user for a selected broadcast.",
        },
      },
      { status: 400 },
    );
  }

  const payload = {
    title,
    body: message,
    data: {
      type: "feature_announcement",
      url: url ?? "/discover",
    },
  };

  const result =
    audience === "all"
      ? await broadcastPush(payload)
      : await sendPushToUsers(userIds ?? [], payload);

  await db.auditLog.create({
    data: {
      actorId: auth.session.user.id,
      action: "push.broadcast",
      targetType: "notification",
      metadata: JSON.stringify({
        audience,
        recipients: result.attempted,
        accepted: result.accepted,
        title,
        url: payload.data.url,
      }),
    },
  });

  return NextResponse.json({
    data: {
      audience,
      attempted: result.attempted,
      sent: result.accepted,
      errors: result.errors,
    },
  });
}
