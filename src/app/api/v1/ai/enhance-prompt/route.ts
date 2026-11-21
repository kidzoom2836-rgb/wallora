import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth-helpers";
import { getConfiguredAIProvider } from "@/lib/ai/provider";
import { checkQuota, recordUsage } from "@/lib/quota";

/**
 * POST /api/v1/ai/enhance-prompt
 *
 * Enhances a simple text prompt into a rich, detailed generation prompt
 * using the AI provider. Auth + quota required.
 */
const EnhanceSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(3, { message: "Prompt must be at least 3 characters" })
    .max(2000, { message: "Prompt is too long" }),
  style: z.string().trim().max(100).optional(),
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

  const parsed = EnhanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: parsed.error.issues[0]?.message ?? "Invalid request." } },
      { status: 400 },
    );
  }

  // Quota check
  const quota = await checkQuota(userId, role, "ai_enhance");
  if (!quota.ok) {
    return NextResponse.json(
      {
        error: {
          code: "quota_exceeded",
          message: "Daily AI limit reached. Please try again tomorrow.",
        },
      },
      { status: 429 },
    );
  }

  try {
    const provider = await getConfiguredAIProvider();
    const result = await provider.enhancePrompt!({
      prompt: parsed.data.prompt,
      style: parsed.data.style,
    });

    await recordUsage({ userId, action: "ai_enhance" });

    return NextResponse.json({ data: { enhanced: result.enhanced } });
  } catch (err) {
    console.error("[ai] enhancePrompt failed:", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Could not enhance the prompt. Please try again." } },
      { status: 500 },
    );
  }
}
