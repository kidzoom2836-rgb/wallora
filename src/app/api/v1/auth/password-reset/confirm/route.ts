import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth-helpers";
import { consumePasswordResetToken } from "@/lib/auth/reset-tokens";

export const runtime = "nodejs";

const ConfirmSchema = z.object({
  token: z.string().min(32, "Invalid reset link."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long")
    .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), {
      message: "Password must include both letters and numbers",
    }),
});

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** POST /api/v1/auth/password-reset/confirm */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "validation_error", "Request body must be valid JSON.");
  }

  const parsed = ConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      400,
      "validation_error",
      parsed.error.issues[0]?.message ?? "Invalid reset request.",
    );
  }

  const email = await consumePasswordResetToken(parsed.data.token);
  if (!email) {
    return errorResponse(
      400,
      "invalid_token",
      "This reset link is invalid, expired, or has already been used.",
    );
  }

  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    return errorResponse(400, "invalid_token", "This reset link is no longer valid.");
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash } }),
    db.auditLog.create({
      data: {
        actorId: user.id,
        action: "auth.password_reset",
        targetType: "user",
        targetId: user.id,
        metadata: JSON.stringify({ via: "email-token" }),
      },
    }),
  ]);

  return NextResponse.json({
    data: { ok: true },
    message: "Your password has been updated. You can now sign in.",
  });
}
