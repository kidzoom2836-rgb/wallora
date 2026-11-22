import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireVerification } from "@/lib/auth-helpers";
import { getConfiguredAIProvider } from "@/lib/ai/provider";
import { getMode } from "@/lib/ai/modes";
import { checkQuota, recordUsage } from "@/lib/quota";

/**
 * POST /api/v1/ai/conversations/[id]/messages
 *
 * The flagship AI endpoint:
 *   1. Auth + ownership check
 *   2. Quota check (daily limit)
 *   3. Save the user's message
 *   4. Load conversation history (last 20 messages for context)
 *   5. Build the messages array with the mode's system prompt
 *   6. Call the AI provider (z-ai-web-dev-sdk)
 *   7. Save the assistant's response
 *   8. Record usage in the ledger
 *   9. Return both messages
 *
 * Never exposes provider secrets. Usage is always recorded. Quota is
 * always checked before the AI call.
 */
const MessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, { message: "Message cannot be empty" })
    .max(4000, { message: "Message is too long (max 4000 characters)" }),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireVerification();
  if (!result.ok) return result.response;

  const { id } = await params;
  const userId = result.session.user.id;
  const role = result.session.user.role;

  // Ownership check
  const conversation = await db.aiConversation.findUnique({
    where: { id },
    select: { userId: true, mode: true, title: true, messageCount: true },
  });

  if (!conversation || conversation.userId !== userId) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Conversation not found." } },
      { status: 404 },
    );
  }

  // Parse + validate the message
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const parsed = MessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: parsed.error.issues[0]?.message ?? "Invalid message." } },
      { status: 400 },
    );
  }

  // Quota check — before the AI call
  const quota = await checkQuota(userId, role, "ai_message");
  if (!quota.ok) {
    return NextResponse.json(
      {
        error: {
          code: "quota_exceeded",
          message: `Daily AI message limit reached (${quota.limit} per day). Your usage resets tomorrow.`,
          remaining: quota.remaining,
          limit: quota.limit,
        },
      },
      { status: 429 },
    );
  }

  const mode = getMode(conversation.mode);

  // Save the user's message
  const userMessage = await db.aiMessage.create({
    data: {
      conversationId: id,
      role: "user",
      content: parsed.data.content,
    },
    select: { id: true, role: true, content: true, createdAt: true },
  });

  // Load conversation history (last 20 messages for context, excluding the one we just saved)
  const history = await db.aiMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { role: true, content: true },
  });

  // Build the messages array for the AI provider
  // The SDK uses 'assistant' role for the system prompt
  const chatMessages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Call the AI provider
  let aiResult;
  try {
    const provider = await getConfiguredAIProvider();
    aiResult = await provider.generateText({
      messages: chatMessages,
      systemPrompt: mode.systemPrompt,
    });
  } catch (err) {
    console.error("[ai] generateText failed:", err);
    // Save an error note as the assistant message so the conversation shows something
    const errorMessage = await db.aiMessage.create({
      data: {
        conversationId: id,
        role: "assistant",
        content: "I couldn't generate a response just now. Please try again in a moment.",
        tokens: 0,
      },
      select: { id: true, role: true, content: true, createdAt: true },
    });

    // Still record usage (the call was attempted)
    await recordUsage({ userId, action: "ai_message", conversationId: id, messageId: errorMessage.id });

    await db.aiConversation.update({
      where: { id },
      data: {
        messageCount: { increment: 2 },
        lastMessageAt: new Date(),
      },
    });

    return NextResponse.json({
      data: {
        userMessage,
        assistantMessage: errorMessage,
        error: "AI generation failed. Please try again.",
      },
    });
  }

  // Save the assistant's response
  const assistantMessage = await db.aiMessage.create({
    data: {
      conversationId: id,
      role: "assistant",
      content: aiResult.content,
      tokens: aiResult.tokens,
    },
    select: { id: true, role: true, content: true, createdAt: true },
  });

  // Record usage
  await recordUsage({
    userId,
    action: "ai_message",
    conversationId: id,
    messageId: assistantMessage.id,
  });

  // Update conversation metadata
  const newTitle = conversation.messageCount === 0
    ? parsed.data.content.slice(0, 60).trim() || "New conversation"
    : undefined;

  await db.aiConversation.update({
    where: { id },
    data: {
      messageCount: { increment: 2 },
      lastMessageAt: new Date(),
      ...(newTitle ? { title: newTitle } : {}),
    },
  });

  return NextResponse.json({
    data: {
      userMessage,
      assistantMessage,
      tokensUsed: aiResult.tokens,
    },
  });
}
