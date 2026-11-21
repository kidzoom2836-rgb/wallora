import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { checkQuota, recordUsage } from "@/lib/quota";
import { generateImage, getGenerationCost } from "@/lib/ai/image-generation";

/**
 * POST /api/v1/ai/generations/[id]/retry
 *
 * Retries a failed generation using the same prompt, style, and aspect ratio.
 * Credits are re-reserved and refunded on failure (same as the original).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const { id } = await params;
  const userId = result.session.user.id;
  const role = result.session.user.role;

  const original = await db.aiGeneration.findUnique({ where: { id } });

  if (!original || original.userId !== userId) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Generation not found." } },
      { status: 404 },
    );
  }

  if (original.status === "completed") {
    return NextResponse.json(
      { error: { code: "conflict", message: "This generation already completed successfully." } },
      { status: 409 },
    );
  }

  const cost = getGenerationCost(original.size);

  // Quota check
  const quota = await checkQuota(userId, role, "ai_generate");
  if (!quota.ok) {
    return NextResponse.json(
      { error: { code: "quota_exceeded", message: "Daily generation limit reached." } },
      { status: 429 },
    );
  }

  const finalPrompt = original.enhancedPrompt ?? original.prompt;

  // Create a new generation record (retry)
  const generation = await db.aiGeneration.create({
    data: {
      userId,
      prompt: original.prompt,
      enhancedPrompt: original.enhancedPrompt,
      stylePreset: original.stylePreset,
      aspectRatio: original.aspectRatio,
      size: original.size,
      status: "processing",
      creditsUsed: cost,
    },
  });

  await recordUsage({ userId, action: "ai_generate", creditsUsed: cost, messageId: generation.id });

  try {
    const result = await generateImage({
      prompt: finalPrompt,
      size: original.size,
      stylePreset: original.stylePreset,
    });

    const updated = await db.aiGeneration.update({
      where: { id: generation.id },
      data: {
        status: "completed",
        objectKey: result.objectKey,
        publicUrl: result.publicUrl,
        width: result.width,
        height: result.height,
        fileSize: result.fileSize,
      },
      select: {
        id: true,
        prompt: true,
        stylePreset: true,
        aspectRatio: true,
        status: true,
        publicUrl: true,
        width: true,
        height: true,
        creditsUsed: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: updated }, { status: 201 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Generation failed.";

    await db.aiGeneration.update({
      where: { id: generation.id },
      data: { status: "failed", errorMessage: errorMessage.slice(0, 500) },
    });

    await recordUsage({ userId, action: "ai_generate_refund", creditsUsed: -cost, messageId: generation.id });

    return NextResponse.json(
      { error: { code: "generation_failed", message: "Retry failed. Credits refunded." } },
      { status: 500 },
    );
  }
}
