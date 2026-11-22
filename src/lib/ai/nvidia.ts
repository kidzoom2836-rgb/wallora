import { getAIConfig, nvidiaKeyConfigured } from "./admin-config";
import type {
  AIProvider,
  ChatMessage,
  ImageAnalysisRequest,
  ImageAnalysisResult,
  PromptEnhanceRequest,
  PromptEnhanceResult,
  TextGenerationRequest,
  TextGenerationResult,
} from "./provider";

type AICapability = "text" | "prompt_enhancement" | "image_analysis" | "suggestions";

function requireKey(): string {
  const key = process.env.NVIDIA_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "NVIDIA_API_KEY is not set. Add it to the project's Vercel environment variables.",
    );
  }
  return key;
}

async function nvidiaFetch(
  baseUrl: string,
  path: string,
  body: unknown,
): Promise<any> {
  const key = requireKey();
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const detail = json?.error?.message ?? json?.message ?? text.slice(0, 200);
    throw new Error(`NVIDIA API error (${res.status}): ${detail}`);
  }
  return json;
}

export class NvidiaProvider implements AIProvider {
  readonly id = "nvidia";
  readonly name = "NVIDIA NIM";

  async getCapabilities(): Promise<AICapability[]> {
    return ["text", "prompt_enhancement", "image_analysis", "suggestions"];
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const config = await getAIConfig();
    const messages: { role: string; content: string }[] = [
      { role: "system", content: request.systemPrompt },
      ...request.messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
    ];
    const json = await nvidiaFetch(config.nvidiaBaseUrl, "/chat/completions", {
      model: config.textModel,
      messages,
      temperature: config.temperature,
      max_tokens: request.maxTokens ?? config.maxTokens,
      stream: false,
    });
    const message = json?.choices?.[0]?.message ?? {};
    // Reasoning models often put the final answer in `content` but can finish
    // on the reasoning channel when max_tokens is low. Handle both.
    const content: string = message.content || message.reasoning_content || "";
    if (!content.trim()) throw new Error("NVIDIA returned an empty response. Try a higher Max Tokens value.");
    const tokens: number =
      typeof json?.usage?.total_tokens === "number"
        ? json.usage.total_tokens
        : Math.ceil(content.length / 4);
    return { content, tokens };
  }

  async enhancePrompt(request: PromptEnhanceRequest): Promise<PromptEnhanceResult> {
    const config = await getAIConfig();
    const styleHint = request.style ? ` The desired style is: ${request.style}.` : "";
    const json = await nvidiaFetch(config.nvidiaBaseUrl, "/chat/completions", {
      model: config.textModel,
      messages: [
        {
          role: "system",
          content:
            "You are a prompt enhancement expert for an AI image generation studio. Transform the user's simple prompt into a rich, detailed generation prompt. Add visual style, lighting, mood, composition, color palette, and quality descriptors. Return ONLY the enhanced prompt — no explanations, no preamble." +
            styleHint,
        },
        { role: "user", content: request.prompt },
      ],
      temperature: config.temperature,
      max_tokens: 512,
      stream: false,
    });
    const msg = json?.choices?.[0]?.message ?? {};
    const enhanced: string = (msg.content || msg.reasoning_content || "").trim() || request.prompt;
    return { enhanced };
  }

  async analyzeImage(request: ImageAnalysisRequest): Promise<ImageAnalysisResult> {
    const config = await getAIConfig();
    const json = await nvidiaFetch(config.nvidiaBaseUrl, "/chat/completions", {
      model: config.textModel,
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
      max_tokens: 512,
      stream: false,
    });
    const msg = json?.choices?.[0]?.message ?? {};
    const description: string = msg.content || msg.reasoning_content || "Could not analyze the image.";
    return { description };
  }
}

/** NVIDIA image generation. Returns base64 bytes for the storage layer. */
export async function generateNvidiaImage(params: {
  prompt: string;
  size: string;
}): Promise<Buffer> {
  requireKey();
  if (!nvidiaKeyConfigured()) {
    throw new Error("NVIDIA_API_KEY is not configured.");
  }
  const config = await getAIConfig();
  const [width, height] = params.size.split("x").map((n) => parseInt(n, 10) || 1024);
  const json = await nvidiaFetch(config.nvidiaBaseUrl, "/images/generations", {
    model: config.imageModel,
    prompt: params.prompt,
    n: 1,
    size: `${width}x${height}`,
    response_format: "b64_json",
  });

  const item = json?.data?.[0] ?? json?.images?.[0] ?? json;
  const b64: string | undefined =
    item?.b64_json ?? item?.base64 ?? item?.image_base64 ?? json?.b64_json;
  if (b64) return Buffer.from(b64, "base64");

  const url: string | undefined = item?.url ?? json?.url ?? json?.output?.url;
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not download generated image (${res.status}).`);
    return Buffer.from(await res.arrayBuffer());
  }

  throw new Error("NVIDIA image generation returned no image data.");
}

/**
 * Diagnostic used by /adminkenya. Returns the live model list and whether the
 * currently selected text model actually accepts a chat completion.
 */
export async function testNvidiaConnection(modelOverride?: string): Promise<{
  keyConfigured: boolean;
  models: string[];
  modelTest: { model: string; ok: boolean; detail: string };
}> {
  const keyConfigured = nvidiaKeyConfigured();
  if (!keyConfigured) {
    return {
      keyConfigured: false,
      models: [],
      modelTest: { model: "", ok: false, detail: "NVIDIA_API_KEY is not set." },
    };
  }

  const config = await getAIConfig();
  const modelToTest =
    typeof modelOverride === "string" && modelOverride.trim()
      ? modelOverride.trim().slice(0, 200)
      : config.textModel;
  let models: string[] = [];
  try {
    const res = await fetch(`${config.nvidiaBaseUrl}/models`, {
      headers: { Authorization: `Bearer ${requireKey()}` },
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      models = Array.isArray(json?.data)
        ? json.data.map((m: { id?: string }) => m.id).filter(Boolean)
        : [];
    }
  } catch {
    /* model list is best-effort */
  }

  let modelTest: { model: string; ok: boolean; detail: string };
  try {
    const json = await nvidiaFetch(config.nvidiaBaseUrl, "/chat/completions", {
      model: modelToTest,
      messages: [{ role: "user", content: "Reply with OK" }],
      max_tokens: 512,
      stream: false,
    });
    const msg = json?.choices?.[0]?.message ?? {};
    const content = (msg.content || msg.reasoning_content || "").trim();
    modelTest = {
      model: modelToTest,
      ok: !!content,
      detail: content ? `Responded: ${content.slice(0, 60)}` : "Empty response",
    };
  } catch (err) {
    modelTest = {
      model: modelToTest,
      ok: false,
      detail: err instanceof Error ? err.message.slice(0, 300) : "Request failed",
    };
  }

  return { keyConfigured, models, modelTest };
}
