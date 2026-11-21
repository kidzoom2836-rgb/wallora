import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { AI_MODES, DEFAULT_MODE_ID } from "@/lib/ai/modes";

/**
 * GET /api/v1/ai/conversations
 * Returns the authenticated user's conversations (most recent first).
 */
export async function GET() {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const conversations = await db.aiConversation.findMany({
    where: { userId: result.session.user.id },
    orderBy: { lastMessageAt: "desc" },
    take: 30,
    select: {
      id: true,
      title: true,
      mode: true,
      messageCount: true,
      lastMessageAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: conversations });
}

const CreateSchema = z.object({
  mode: z.string().default(DEFAULT_MODE_ID),
  title: z.string().trim().max(120).optional(),
});

/**
 * POST /api/v1/ai/conversations
 * Creates a new conversation for the authenticated user.
 */
export async function POST(request: NextRequest) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: parsed.error.issues[0]?.message ?? "Invalid request." } },
      { status: 400 },
    );
  }

  // Validate the mode exists
  const mode = AI_MODES.find((m) => m.id === parsed.data.mode) ?? AI_MODES[0];

  const conversation = await db.aiConversation.create({
    data: {
      userId: result.session.user.id,
      mode: mode.id,
      title: parsed.data.title ?? "New conversation",
    },
    select: {
      id: true,
      title: true,
      mode: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: conversation }, { status: 201 });
}
