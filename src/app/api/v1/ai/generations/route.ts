import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { checkQuota, recordUsage } from "@/lib/quota";
import { generateImage, getGenerationCost } from "@/lib/ai/image-generation";
import { getSizeForAspect, type AspectRatio } from "@/lib/ai/presets";
import { getAIProvider } from "@/lib/ai/provider";

/**
 * POST /api/v1/ai/generations
 *
 * The AI Studio generation endpoint:
 *   1. Auth + quota check (credit reservation)
 *   2. Validate prompt, style preset, aspect ratio
 *   3. Optionally enhance the prompt
 *   4. Create AiGeneration record (status=processing)
 *   5. Record usage (credits reserved)
 *   6. Call the image generation provider (z-ai-web-dev-sdk)
 *   7. Store the output via the storage adapter
 *   8. Update record (status=completed) with image URL
 *   9. On failure: update record (status=failed) + refund credits
 *
 * Auth required. Credits are always accounted for correctly.
 */
const GenerateSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(3, { message: "Prompt must be at least 3 characters" })
    .max(2000, { message: "Prompt is too long" }),
  stylePreset: z.string().default("none"),
  aspectRatio: z.enum(["square", "portrait", "landscape"]).default("square"),
  enhance: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const userId = result.session.user.id;
  const role = result.session.user.role;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const parsed = GenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: parsed.error.issues[0]?.message ?? "Invalid request." } },
      { status: 400 },
    );
  }

  const { prompt, stylePreset, aspectRatio, enhance } = parsed.data;
  const size = getSizeForAspect(aspectRatio as AspectRatio);
  const cost = getGenerationCost(size);

  // Quota check — before any work
  const quota = await checkQuota(userId, role, "ai_generate");
  if (!quota.ok) {
    return NextResponse.json(
      {
        error: {
          code: "quota_exceeded",
          message: `Daily generation limit reached. You have ${quota.remaining} credits remaining (need ${cost}). Resets tomorrow.`,
          remaining: quota.remaining,
          limit: quota.limit,
          needed: cost,
        },
      },
      { status: 429 },
    );
  }

  // Optionally enhance the prompt first
  let enhancedPrompt: string | null = null;
  if (enhance) {
    try {
      const provider = getAIProvider();
      const enhanced = await provider.enhancePrompt!({ prompt });
      enhancedPrompt = enhanced.enhanced;
    } catch {
      // Enhancement failure is non-fatal — fall back to the original prompt
    }
  }

  const finalPrompt = enhancedPrompt ?? prompt;

  // Create the generation record (status=processing)
  const generation = await db.aiGeneration.create({
    data: {
      userId,
      prompt,
      enhancedPrompt,
      stylePreset,
      aspectRatio,
      size,
      status: "processing",
      creditsUsed: cost,
    },
  });

  // Record usage (credits reserved)
  await recordUsage({
    userId,
    action: "ai_generate",
    creditsUsed: cost,
    messageId: generation.id,
  });

  // Generate the image
  try {
    const result = await generateImage({
      prompt: finalPrompt,
      size,
      stylePreset,
    });

    // Update the record with the result
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
        enhancedPrompt: true,
        stylePreset: true,
        aspectRatio: true,
        size: true,
        status: true,
        publicUrl: true,
        width: true,
        height: true,
        fileSize: true,
        creditsUsed: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: updated }, { status: 201 });
  } catch (err) {
    // Generation failed — refund credits
    const errorMessage = err instanceof Error ? err.message : "Generation failed.";

    await db.aiGeneration.update({
      where: { id: generation.id },
      data: {
        status: "failed",
        errorMessage: errorMessage.slice(0, 500),
      },
    });

    // Refund the credits (negative usage entry)
    await recordUsage({
      userId,
      action: "ai_generate_refund",
      creditsUsed: -cost,
      messageId: generation.id,
    });

    return NextResponse.json(
      {
        error: {
          code: "generation_failed",
          message: "Image generation failed. Your credits have been refunded.",
          generationId: generation.id,
        },
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/v1/ai/generations
 * Returns the authenticated user's generation history.
 */
export async function GET(request: NextRequest) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(24, Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10) || 12));

  const [total, items] = await Promise.all([
    db.aiGeneration.count({ where: { userId: result.session.user.id } }),
    db.aiGeneration.findMany({
      where: { userId: result.session.user.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        prompt: true,
        stylePreset: true,
        aspectRatio: true,
        size: true,
        status: true,
        publicUrl: true,
        width: true,
        height: true,
        creditsUsed: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    data: {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    },
  });
}
