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

export const TEXT_MODELS = [
  { id: "zai:auto", provider: "zai", label: "ZAI Web Dev SDK (default)", note: "Current provider" },
  { id: "meta/llama-3.3-70b-instruct", provider: "nvidia", label: "Llama 3.3 70B", note: "NVIDIA NIM" },
  { id: "meta/llama-3.1-405b-instruct", provider: "nvidia", label: "Llama 3.1 405B", note: "NVIDIA NIM" },
  { id: "nvidia/llama-3.3-nemotron-super-49b-v1", provider: "nvidia", label: "Nemotron Super 49B", note: "NVIDIA NIM" },
  { id: "deepseek-ai/deepseek-r1", provider: "nvidia", label: "DeepSeek R1", note: "NVIDIA NIM" },
  { id: "qwen/qwen3-235b-a22b", provider: "nvidia", label: "Qwen3 235B", note: "NVIDIA NIM" },
] as const;

export const IMAGE_MODELS = [
  { id: "zai:auto", provider: "zai", label: "ZAI Web Dev SDK (default)", note: "Current provider" },
  { id: "stabilityai/stable-diffusion-3-medium", provider: "nvidia", label: "Stable Diffusion 3 Medium", note: "NVIDIA NIM" },
  { id: "black-forest-labs/flux.1-dev", provider: "nvidia", label: "FLUX.1 dev", note: "NVIDIA NIM" },
  { id: "nvidia/flux.1-schnell", provider: "nvidia", label: "FLUX.1 schnell", note: "NVIDIA NIM" },
] as const;

function sanitize(input: Partial<AIConfig> | null | undefined): AIConfig {
  if (!input || typeof input !== "object") return { ...DEFAULT_AI_CONFIG };
  const textModel = typeof input.textModel === "string" ? input.textModel : DEFAULT_AI_CONFIG.textModel;
  const imageModel = typeof input.imageModel === "string" ? input.imageModel : DEFAULT_AI_CONFIG.imageModel;
  const textProvider: AIProviderId =
    input.textProvider === "nvidia" || textModel.includes("/") ? "nvidia" : "zai";
  const imageProvider: AIProviderId =
    input.imageProvider === "nvidia" || imageModel.includes("/") ? "nvidia" : "zai";
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
