import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireVerification } from "@/lib/auth-helpers";
import { getConfiguredAIProvider } from "@/lib/ai/provider";
import { getMode } from "@/lib/ai/modes";
import { checkQuota, recordUsage } from "@/lib/quota";
import { getStorage } from "@/lib/storage";
import {
  AI_ATTACHMENT_MAX_COUNT,
  attachmentToContext,
  readAttachmentMeta,
  saveMessageAttachments,
  type AiAttachment,
} from "@/lib/ai/attachments";

/**
 * POST /api/v1/ai/conversations/[id]/messages
 *
 * The flagship AI endpoint:
 *   1. Auth + ownership check
 *   2. Quota check (daily limit)
 *   3. Save the user's message (+ any uploaded attachment references)
 *   4. Load conversation history (last 20 messages for context)
 *   5. Build the messages array with the mode's system prompt, including
 *      vision descriptions / document text for attached files
 *   6. Call the AI provider (z-ai-web-dev-sdk)
 *   7. Save the assistant's response
 *   8. Record usage in the ledger
 *   9. Return both messages
 *
 * Never exposes provider secrets. Usage is always recorded. Quota is
 * always checked before the AI call.
 */
const MessageSchema = z
  .object({
    content: z
      .string()
      .trim()
      .max(4000, { message: "Message is too long (max 4000 characters)" }),
    attachmentIds: z.array(z.string().trim().min(1).max(120)).max(AI_ATTACHMENT_MAX_COUNT).optional(),
  })
  .refine((data) => data.content.length > 0 || (data.attachmentIds?.length ?? 0) > 0, {
    message: "Write a message or attach a file.",
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

  // Load + verify attachments (only files owned by this user).
  const attachmentIds = Array.from(new Set(parsed.data.attachmentIds ?? []));
  const attachments: AiAttachment[] = [];
  for (const attachmentId of attachmentIds) {
    const meta = await readAttachmentMeta(userId, attachmentId);
    if (meta) attachments.push(meta);
  }

  const mode = getMode(conversation.mode);
  const storage = getStorage();
  const provider = await getConfiguredAIProvider();

  // Turn each attachment into text the model can reason about. Images are
  // described with the provider's vision capability; documents are decoded.
  const contextParts: string[] = [];
  await Promise.all(
    attachments.map(async (attachment) => {
      if (attachment.kind === "image") {
        try {
          const buffer = await storage.getObject(attachment.key);
          const description = provider.analyzeImage
            ? (
                await provider.analyzeImage({
                  imageBase64: buffer.toString("base64"),
                  prompt: `Describe this image precisely for a creative design assistant. Include subject, style, colors, composition, text visible in the image, and any details relevant to wallpaper or UI design. Attached file name: ${attachment.name}`,
                })
              ).description
            : null;
          contextParts.push(
            `[Attached image: ${attachment.name}]\n${description ?? "Image description unavailable."}`,
          );
        } catch {
          contextParts.push(`[Attached image: ${attachment.name} — could not be analyzed]`);
        }
        return;
      }
      contextParts.push(await attachmentToContext(attachment, (key) => storage.getObject(key)));
    }),
  );

  const attachmentContext = contextParts.length
    ? `\n\n--- USER ATTACHMENTS ---\n${contextParts.join("\n\n")}\n--- END ATTACHMENTS ---`
    : "";

  // The visible user message stays clean; attachments are rendered as chips.
  const visibleContent = parsed.data.content || "(Attached files)";

  // Save the user's message
  const userMessage = await db.aiMessage.create({
    data: {
      conversationId: id,
      role: "user",
      content: visibleContent,
    },
    select: { id: true, role: true, content: true, createdAt: true },
  });

  if (attachments.length) {
    await saveMessageAttachments(userMessage.id, attachments);
  }

  // Load conversation history (last 20 messages for context, excluding the one we just saved)
  const history = (
    await db.aiMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, role: true, content: true },
    })
  ).reverse();

  // Build the messages array for the AI provider. Attachments are folded into
  // the newest user turn so earlier history is not repeatedly re-analyzed.
  const chatMessages = history.map((m, index) => ({
    role: m.role as "user" | "assistant",
    content:
      m.id === userMessage.id && attachmentContext
        ? `${m.content}${attachmentContext}`
        : m.content,
  }));

  // Call the AI provider
  let aiResult;
  try {
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
        userMessage: { ...userMessage, attachments },
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
    ? visibleContent.slice(0, 60).trim() || "New conversation"
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
      userMessage: {
        ...userMessage,
        attachments: attachments.map((a) => ({
          id: a.id,
          name: a.name,
          kind: a.kind,
          url: a.url,
          size: a.size,
        })),
      },
      assistantMessage,
      tokensUsed: aiResult.tokens,
    },
  });
}
