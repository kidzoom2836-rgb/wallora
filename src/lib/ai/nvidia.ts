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
      max_tokens: config.maxTokens,
      stream: false,
    });
    const content: string = json?.choices?.[0]?.message?.content ?? "";
    if (!content.trim()) throw new Error("NVIDIA returned an empty response. Please try again.");
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
    const enhanced: string = json?.choices?.[0]?.message?.content?.trim() ?? request.prompt;
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
    const description: string =
      json?.choices?.[0]?.message?.content ?? "Could not analyze the image.";
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
