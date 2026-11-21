import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";

/**
 * GET /api/v1/ai/conversations/[id]
 * Returns a conversation with all its messages. Only the owner can access it.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const { id } = await params;

  const conversation = await db.aiConversation.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, createdAt: true },
      },
    },
  });

  if (!conversation || conversation.userId !== result.session.user.id) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Conversation not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: {
      id: conversation.id,
      title: conversation.title,
      mode: conversation.mode,
      messageCount: conversation.messageCount,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages,
    },
  });
}

/**
 * PATCH /api/v1/ai/conversations/[id]
 * Updates the conversation title or mode.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const { id } = await params;

  const conversation = await db.aiConversation.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!conversation || conversation.userId !== result.session.user.id) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Conversation not found." } },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid JSON." } },
      { status: 400 },
    );
  }

  const data: { title?: string; mode?: string } = {};
  if (typeof (body as Record<string, unknown>)?.title === "string") {
    data.title = (body as Record<string, string>).title.trim().slice(0, 120);
  }
  if (typeof (body as Record<string, unknown>)?.mode === "string") {
    data.mode = (body as Record<string, string>).mode;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "No updatable fields." } },
      { status: 400 },
    );
  }

  const updated = await db.aiConversation.update({
    where: { id },
    data,
    select: { id: true, title: true, mode: true },
  });

  return NextResponse.json({ data: updated });
}

/**
 * DELETE /api/v1/ai/conversations/[id]
 * Deletes a conversation and all its messages. Only the owner can delete.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const { id } = await params;

  const conversation = await db.aiConversation.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!conversation || conversation.userId !== result.session.user.id) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Conversation not found." } },
      { status: 404 },
    );
  }

  await db.aiConversation.delete({ where: { id } });

  return NextResponse.json({ data: { deleted: true } });
}
