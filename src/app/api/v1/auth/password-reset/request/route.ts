import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { createPasswordResetToken } from "@/lib/auth/reset-tokens";

export const runtime = "nodejs";

const RequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function sendResetEmail(to: string, webUrl: string, deepLink: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

  const from = process.env.WALLORA_EMAIL_FROM || "WALLORA <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Reset your WALLORA password",
      text: [
        "Reset your WALLORA password",
        "",
        `Open this link to choose a new password: ${webUrl}`,
        "",
        "Using the WALLORA app? Open this link instead: " + deepLink,
        "",
        "This link expires in 60 minutes and can only be used once.",
        "If you did not request this, you can ignore this email.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;background:#0B0C0F;color:#F7F7F5;padding:32px;">
          <h1 style="font-size:20px;margin:0 0 16px;">Reset your WALLORA password</h1>
          <p style="color:#9296A1;line-height:1.6;font-size:14px;">
            We received a request to reset the password for your WALLORA account.
          </p>
          <p style="margin:24px 0;">
            <a href="${webUrl}" style="background:#D7B879;color:#0B0C0F;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700;">Choose a new password</a>
          </p>
          <p style="color:#9296A1;line-height:1.6;font-size:12px;">
            Using the WALLORA app? <a href="${deepLink}" style="color:#D7B879;">Open the reset screen here</a>.
            This link expires in 60 minutes and can only be used once. If you did not request this, ignore this email.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend rejected the reset email: ${response.status} ${detail.slice(0, 200)}`);
  }
}

/** POST /api/v1/auth/password-reset/request */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "validation_error", "Request body must be valid JSON.");
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Enter a valid email address.");
  }

  const { email } = parsed.data;

  // Check configuration first so an unconfigured environment fails clearly for
  // every request instead of leaking whether an account exists.
  if (!process.env.RESEND_API_KEY) {
    console.error("[password-reset] RESEND_API_KEY is not configured");
    return errorResponse(
      503,
      "email_unavailable",
      "Password reset email is temporarily unavailable. Please try again later.",
    );
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  // Always respond the same way when email delivery is configured, whether or
  // not the address belongs to an account.
  if (user) {
    try {
      const token = await createPasswordResetToken(email);
      const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      const webUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
      const deepLink = `wallora://auth/reset-password?token=${encodeURIComponent(token)}`;
      await sendResetEmail(email, webUrl, deepLink);
    } catch (err) {
      console.error("[password-reset] failed to deliver email:", err);
      return errorResponse(
        503,
        "email_unavailable",
        "Password reset email is temporarily unavailable. Please try again later.",
      );
    }
  }

  return NextResponse.json({
    data: { ok: true },
    message: "If that email belongs to an account, a reset link is on its way.",
  });
}
