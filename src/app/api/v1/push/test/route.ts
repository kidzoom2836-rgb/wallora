import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth-helpers";
import { sendPushToUsers } from "@/lib/push/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/push/test — deliver a sample alert to the signed-in user's devices. */
export async function POST() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const result = await sendPushToUsers([auth.session.user.id], {
    title: "WALLORA notifications are on",
    body: "New wallpapers, features and artwork updates will land here.",
    data: { type: "push_test", url: "/settings" },
  }).catch(() => ({
    attempted: 0,
    accepted: 0,
    invalidTokens: [],
    errors: ["Push service is unavailable."],
  }));

  if (!result.accepted) {
    return NextResponse.json(
      {
        error: {
          code: "push_unavailable",
          message: result.errors[0] ?? "No registered device is eligible for push notifications.",
        },
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ data: { sent: result.accepted } });
}
