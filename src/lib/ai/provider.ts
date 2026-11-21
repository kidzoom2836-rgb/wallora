import ZAI from "z-ai-web-dev-sdk";

import type { AICapability } from "./modes";

/**
 * WALLORA AI provider abstraction.
 *
 * Implements the capability-based interface from spec PART 7. The primary
 * provider is z-ai-web-dev-sdk (adapted from NVIDIA NIM). Capabilities are
 * surfaced honestly — only operations the provider actually supports are
 * advertised.
 */

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type TextGenerationRequest = {
  messages: ChatMessage[];
  /** The WALLORA AI mode system prompt (sent as the first assistant message). */
  systemPrompt: string;
  /** Optional per-request override (site generation needs long outputs). */
  maxTokens?: number;
};

export type TextGenerationResult = {
  content: string;
  tokens: number;
};

export type ImageAnalysisRequest = {
  imageBase64: string;
  prompt: string;
};

export type ImageAnalysisResult = {
  description: string;
};

export type PromptEnhanceRequest = {
  prompt: string;
  style?: string;
};

export type PromptEnhanceResult = {
  enhanced: string;
};

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  getCapabilities(): Promise<AICapability[]>;
  generateText(request: TextGenerationRequest): Promise<TextGenerationResult>;
  enhancePrompt?(request: PromptEnhanceRequest): Promise<PromptEnhanceResult>;
  analyzeImage?(request: ImageAnalysisRequest): Promise<ImageAnalysisResult>;
}

/** Cache the SDK instance — it's expensive to create. */
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

/**
 * ZAIProvider — the primary and only provider in this environment.
 *
 * Capabilities: text generation, prompt enhancement, image analysis.
 * Image generation is handled separately in Phase 6 (AI Studio).
 */
export class ZAIProvider implements AIProvider {
  readonly id = "zai";
  readonly name = "ZAI Web Dev SDK";

  async getCapabilities(): Promise<AICapability[]> {
    return ["text", "prompt_enhancement", "image_analysis", "suggestions"];
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const zai = await getZAI();

    // The SDK uses 'assistant' role for the system prompt
    const messages = [
      { role: "assistant" as const, content: request.systemPrompt },
      ...request.messages,
    ];

    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: "disabled" },
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
    });

    const content = completion.choices[0]?.message?.content ?? "";

    if (!content || content.trim().length === 0) {
      throw new Error("AI returned an empty response. Please try again.");
    }

    // Estimate tokens (~4 chars per token)
    const tokens = Math.ceil(content.length / 4);

    return { content, tokens };
  }

  async enhancePrompt(request: PromptEnhanceRequest): Promise<PromptEnhanceResult> {
    const zai = await getZAI();

    const styleHint = request.style
      ? ` The desired style is: ${request.style}.`
      : "";

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content: `You are a prompt enhancement expert for an AI image generation studio. Transform the user's simple prompt into a rich, detailed generation prompt. Add: visual style, lighting, mood, composition, color palette, and quality descriptors. Return ONLY the enhanced prompt — no explanations, no preamble.${styleHint}`,
        },
        { role: "user", content: request.prompt },
      ],
      thinking: { type: "disabled" },
    });

    const enhanced = completion.choices[0]?.message?.content?.trim() ?? request.prompt;

    return { enhanced };
  }

  async analyzeImage(request: ImageAnalysisRequest): Promise<ImageAnalysisResult> {
    const zai = await getZAI();

    // Use the vision model for image analysis
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: request.prompt },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${request.imageBase64}` },
            },
          ],
        },
      ],
    } as never);

    const description = (response as { choices?: { message?: { content?: string } }[] })
      .choices?.[0]?.message?.content ?? "Could not analyze the image.";

    return { description };
  }
}

let cachedProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!cachedProvider) {
    cachedProvider = new ZAIProvider();
  }
  return cachedProvider;
}

/**
 * Resolves the text provider chosen in the hidden /adminkenya control panel.
 * Falls back to ZAI for any unknown configuration.
 */
export async function getConfiguredAIProvider(): Promise<AIProvider> {
  const { getAIConfig } = await import("./admin-config");
  const config = await getAIConfig();
  const useNvidia =
    config.textProvider === "nvidia" ||
    config.textModel === "nvidia" ||
    config.textModel.includes("/");
  if (!useNvidia) return getAIProvider();
  const { NvidiaProvider } = await import("./nvidia");
  return new NvidiaProvider();
}
