import type { AICapability } from "./modes";
import type {
  AIProvider,
  ImageAnalysisRequest,
  ImageAnalysisResult,
  PromptEnhanceRequest,
  PromptEnhanceResult,
  TextGenerationRequest,
  TextGenerationResult,
} from "./provider";

/**
 * WALLORA Free — powered by Pollinations' public endpoints.
 *
 * No API key is used or exposed. Text uses the OpenAI-compatible
 * `text.pollinations.ai/openai` endpoint; images use the public prompt URL.
 * These are shared free tiers, so rate limits are expected. All calls happen
 * on the server and are wrapped with timeouts so a slow upstream cannot pin
 * a Next.js request indefinitely.
 */

const TEXT_URL = "https://text.pollinations.ai/openai";
const IMAGE_URL = "https://image.pollinations.ai/prompt";

async function postText(messages: { role: string; content: string }[], maxTokens = 1024): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(TEXT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        messages,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    const raw = await res.text();
    if (!res.ok) {
      let message = raw.slice(0, 200);
      try {
        const parsed = JSON.parse(raw);
        message = parsed?.error?.message ?? parsed?.message ?? message;
      } catch {
        /* non-JSON error */
      }
      throw new Error(`WALLORA Free is unavailable (${res.status}): ${message}`);
    }

    let json: any = {};
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error("WALLORA Free returned an unexpected response.");
    }

    const message = json?.choices?.[0]?.message ?? {};
    const content: string = message.content ?? json?.content ?? "";
    if (!content.trim()) throw new Error("WALLORA Free returned an empty response.");
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

export class PollinationsProvider implements AIProvider {
  readonly id = "pollinations";
  readonly name = "WALLORA Free (Pollinations)";

  async getCapabilities(): Promise<AICapability[]> {
    return ["text", "prompt_enhancement", "suggestions"];
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const messages = [
      { role: "system", content: request.systemPrompt },
      ...request.messages.map((m) => ({ role: m.role, content: m.content })),
    ];
    const content = await postText(messages, request.maxTokens ?? 1024);
    return { content, tokens: Math.ceil(content.length / 4) };
  }

  async enhancePrompt(request: PromptEnhanceRequest): Promise<PromptEnhanceResult> {
    const styleHint = request.style ? ` The desired style is: ${request.style}.` : "";
    const enhanced = await postText(
      [
        {
          role: "system",
          content:
            "You are a prompt enhancement expert for an AI image generation studio. Transform the user's simple prompt into a rich, detailed generation prompt. Add visual style, lighting, mood, composition, color palette, and quality descriptors. Return ONLY the enhanced prompt — no explanations, no preamble." +
            styleHint,
        },
        { role: "user", content: request.prompt },
      ],
      512,
    );
    return { enhanced: enhanced.trim() || request.prompt };
  }

  async analyzeImage(_request: ImageAnalysisRequest): Promise<ImageAnalysisResult> {
    throw new Error("WALLORA Free does not support image analysis. Choose ZAI or NVIDIA for this mode.");
  }
}

/** Generate an image with the free Pollinations prompt endpoint. */
export async function generatePollinationsImage(params: {
  prompt: string;
  size: string;
}): Promise<Buffer> {
  const [width, height] = params.size.split("x").map((n) => parseInt(n, 10) || 1024);
  const url = new URL(`${IMAGE_URL}/${encodeURIComponent(params.prompt.slice(0, 1800))}`);
  url.searchParams.set("width", String(width));
  url.searchParams.set("height", String(height));
  url.searchParams.set("nologo", "true");
  url.searchParams.set("seed", String(Math.floor(Math.random() * 1_000_000_000)));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) {
      const raw = await res.text();
      let message = raw.slice(0, 240);
      try {
        const parsed = JSON.parse(raw);
        message = parsed?.error?.message ?? parsed?.message ?? message;
      } catch {
        /* non-JSON error */
      }
      if (res.status === 402 || res.status === 429 || /free limit/i.test(message)) {
        throw new Error(
          "WALLORA Free image limit reached for now. Try again in a moment or switch to ZAI in admin settings.",
        );
      }
      throw new Error(`WALLORA Free image generation failed (${res.status}): ${message}`);
    }
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}
