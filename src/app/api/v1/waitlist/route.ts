import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

/**
 * WALLORA waitlist endpoint.
 * Captures early-access intent from the landing page CTAs.
 *
 * Versioned per spec PART 8: /api/v1
 */

const INTENTS = ["creator", "explorer", "studio", "general"] as const;

const WaitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .min(5, { message: "Email is required" })
    .email({ message: "Enter a valid email address" })
    .max(254, { message: "Email is too long" }),
  name: z
    .string()
    .trim()
    .max(80, { message: "Name is too long" })
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  intent: z.enum(INTENTS).default("general"),
  prompt: z
    .string()
    .trim()
    .max(2000, { message: "Prompt is too long" })
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  message: z
    .string()
    .trim()
    .max(2000, { message: "Message is too long" })
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

type WaitlistInput = z.infer<typeof WaitlistSchema>;

function errorResponse(status: number, message: string, details?: unknown) {
  return NextResponse.json(
    {
      error: {
        code: status === 400 ? "validation_error" : status === 409 ? "conflict" : "server_error",
        message,
        ...(details ? { details } : {}),
      },
    },
    { status },
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "Request body must be valid JSON.");
  }

  const parsed = WaitlistSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return errorResponse(
      400,
      firstError?.message ?? "Invalid request.",
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }

  const data: WaitlistInput = parsed.data;
  const email = data.email.toLowerCase();

  try {
    const entry = await db.waitlistEntry.create({
      data: {
        email,
        name: data.name,
        intent: data.intent,
        prompt: data.prompt,
        message: data.message,
      },
      select: {
        id: true,
        email: true,
        intent: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        data: entry,
        message: "You are on the waitlist. We will be in touch soon.",
      },
      { status: 201 },
    );
  } catch (err) {
    const prismaErr = err as { code?: string } | null;
    if (prismaErr?.code === "P2002") {
      return errorResponse(
        409,
        "This email is already on the WALLORA waitlist. We will be in touch soon.",
      );
    }
    console.error("[waitlist] insert failed:", err);
    return errorResponse(500, "Something went wrong joining the waitlist. Please try again.");
  }
}

/** Lightweight health check for the v1 API surface. */
export async function GET() {
  return NextResponse.json({
    data: {
      endpoint: "/api/v1/waitlist",
      method: "POST",
      intents: INTENTS,
      status: "operational",
    },
  });
}
