import { db } from "@/lib/db";

/**
 * Admin-controlled AI configuration.
 *
 * Stored in the existing `StoredBlob` table under a reserved key so no schema
 * migration is required. The value is JSON, written only by /adminkenya.
 */

export type AIProviderId = "zai" | "nvidia";

export interface AIConfig {
  textProvider: AIProviderId;
  textModel: string;
  imageProvider: AIProviderId;
  imageModel: string;
  nvidiaBaseUrl: string;
  temperature: number;
  maxTokens: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export const AI_CONFIG_KEY = "system:ai-config";

export const DEFAULT_AI_CONFIG: AIConfig = {
  textProvider: "zai",
  textModel: "zai:auto",
  imageProvider: "zai",
  imageModel: "zai:auto",
  nvidiaBaseUrl: "https://integrate.api.nvidia.com/v1",
  temperature: 0.7,
  maxTokens: 2048,
  updatedAt: null,
  updatedBy: null,
};

/**
 * Verified against https://integrate.api.nvidia.com/v1/models on 2026-11-21.
 * Older model IDs (llama-3.3, deepseek-r1, qwen3-235b, nemotron-super-49b)
 * have reached end-of-life and return HTTP 410/404 — never offer them.
 */
export const TEXT_MODELS = [
  { id: "zai:auto", provider: "zai", label: "ZAI Web Dev SDK (default)", note: "Current provider" },
  { id: "minimaxai/minimax-m3.1-flash", provider: "nvidia", label: "MiniMax M3.1 Flash", note: "Fast · verified" },
  { id: "nvidia/nemotron-3.5-lightning-30b-a3b", provider: "nvidia", label: "Nemotron 3.5 Lightning 30B", note: "Reasoning · verified" },
  { id: "mistralai/mistral-large-4-1t-a52b", provider: "nvidia", label: "Mistral Large 4", note: "Reasoning · verified" },
] as const;

/**
 * The configured NVIDIA endpoint does not expose a text-to-image model
 * (all images/generations and text-to-image calls return 404).
 * Image generation therefore stays on ZAI until an NVIDIA image endpoint is
 * actually provisioned for this key.
 */
export const IMAGE_MODELS = [
  { id: "zai:auto", provider: "zai", label: "ZAI Web Dev SDK", note: "Only available image provider" },
] as const;

/** Models that used to be offered but are now dead. Auto-migrated on read. */
const DEPRECATED_TEXT_MODELS: Record<string, string> = {
  "meta/llama-3.3-70b-instruct": "minimaxai/minimax-m3.1-flash",
  "meta/llama-3.1-405b-instruct": "minimaxai/minimax-m3.1-flash",
  "nvidia/llama-3.3-nemotron-super-49b-v1": "minimaxai/minimax-m3.1-flash",
  "deepseek-ai/deepseek-r1": "minimaxai/minimax-m3.1-flash",
  "qwen/qwen3-235b-a22b": "minimaxai/minimax-m3.1-flash",
};

const DEPRECATED_IMAGE_MODELS = new Set([
  "stabilityai/stable-diffusion-3-medium",
  "black-forest-labs/flux.1-dev",
  "nvidia/flux.1-schnell",
]);

function sanitize(input: Partial<AIConfig> | null | undefined): AIConfig {
  if (!input || typeof input !== "object") return { ...DEFAULT_AI_CONFIG };

  let textModel = typeof input.textModel === "string" ? input.textModel : DEFAULT_AI_CONFIG.textModel;
  textModel = DEPRECATED_TEXT_MODELS[textModel] ?? textModel;

  let imageModel = typeof input.imageModel === "string" ? input.imageModel : DEFAULT_AI_CONFIG.imageModel;
  if (DEPRECATED_IMAGE_MODELS.has(imageModel)) imageModel = "zai:auto";

  let textProvider: AIProviderId =
    input.textProvider === "nvidia" || textModel.includes("/") ? "nvidia" : "zai";
  let imageProvider: AIProviderId =
    input.imageProvider === "nvidia" || imageModel.includes("/") ? "nvidia" : "zai";

  // No working NVIDIA image endpoint — force image generation onto ZAI.
  if (imageProvider === "nvidia") {
    imageProvider = "zai";
    imageModel = "zai:auto";
  }

  return {
    textProvider,
    textModel,
    imageProvider,
    imageModel,
    nvidiaBaseUrl:
      typeof input.nvidiaBaseUrl === "string" && input.nvidiaBaseUrl.trim()
        ? input.nvidiaBaseUrl.trim().replace(/\/$/, "")
        : DEFAULT_AI_CONFIG.nvidiaBaseUrl,
    temperature:
      typeof input.temperature === "number" && Number.isFinite(input.temperature)
        ? Math.min(2, Math.max(0, input.temperature))
        : DEFAULT_AI_CONFIG.temperature,
    maxTokens:
      typeof input.maxTokens === "number" && Number.isFinite(input.maxTokens)
        ? Math.min(8192, Math.max(256, Math.round(input.maxTokens)))
        : DEFAULT_AI_CONFIG.maxTokens,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : null,
    updatedBy: typeof input.updatedBy === "string" ? input.updatedBy : null,
  };
}

export async function getAIConfig(): Promise<AIConfig> {
  try {
    const blob = await db.storedBlob.findUnique({ where: { key: AI_CONFIG_KEY } });
    if (!blob) return { ...DEFAULT_AI_CONFIG };
    const parsed = JSON.parse(Buffer.from(blob.data).toString("utf8"));
    return sanitize(parsed);
  } catch {
    return { ...DEFAULT_AI_CONFIG };
  }
}

export async function saveAIConfig(
  patch: Partial<AIConfig>,
  actorId: string,
): Promise<AIConfig> {
  const current = await getAIConfig();
  const next = sanitize({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
  const body = Buffer.from(JSON.stringify(next, null, 2), "utf8");
  await db.storedBlob.upsert({
    where: { key: AI_CONFIG_KEY },
    update: { data: body, contentType: "application/json", size: body.length },
    create: { key: AI_CONFIG_KEY, data: body, contentType: "application/json", size: body.length },
  });
  return next;
}

/** Never expose the key — only whether one is configured. */
export function nvidiaKeyConfigured(): boolean {
  return !!process.env.NVIDIA_API_KEY?.trim();
}
