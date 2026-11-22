import { db } from "@/lib/db";

/**
 * Admin-controlled AI configuration.
 *
 * Stored in the existing `StoredBlob` table under a reserved key so no schema
 * migration is required. The value is JSON, written only by /adminkenya.
 */

export type AIProviderId = "zai" | "nvidia" | "pollinations";

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
 * Curated chat models. Verified entries were tested against the configured
 * NIM key; the rest come from the public NVIDIA catalog and must be tested in
 * /adminkenya before being relied on. Public listing does not guarantee that a
 * specific key is entitled to a model.
 */
export const TEXT_MODELS = [
  { id: "zai:auto", provider: "zai", label: "ZAI Web Dev SDK (default)", note: "Current provider" },
  { id: "pollinations:free", provider: "pollinations", label: "WALLORA Free", note: "Pollinations · no key · shared tier" },
  { id: "minimaxai/minimax-m3.1-flash", provider: "nvidia", label: "MiniMax M3.1 Flash", note: "Fast chat · vision · verified" },
  { id: "nvidia/nemotron-3.5-lightning-30b-a3b", provider: "nvidia", label: "Nemotron 3.5 Lightning 30B", note: "Fast reasoning · verified" },
  { id: "mistralai/mistral-large-4-1t-a52b", provider: "nvidia", label: "Mistral Large 4", note: "Reasoning · vision · verified" },
  { id: "google/gemma-3-12b-it", provider: "nvidia", label: "Gemma 3 12B IT", note: "Vision · fast · catalog" },
  { id: "google/gemma-4-31b-it", provider: "nvidia", label: "Gemma 4 31B IT", note: "Reasoning · coding · catalog" },
  { id: "meta/muse-glimmer-30b", provider: "nvidia", label: "Muse Glimmer 30B", note: "Multimodal · tools · catalog" },
  { id: "moonshotai/kimi-k3.1-pro", provider: "nvidia", label: "Kimi K3.1 Pro", note: "1M context · coding · catalog" },
  { id: "nvidia/nemotron-3-ultra-550b-a55b", provider: "nvidia", label: "Nemotron 3 Ultra 550B", note: "1M context · reasoning · catalog" },
  { id: "nvidia/nemotron-3.5-bolt-e4b", provider: "nvidia", label: "Nemotron 3.5 Bolt E4B", note: "Compact reasoning · catalog" },
  { id: "nvidia/nemotron-3.5-super-vl-120b-a12b", provider: "nvidia", label: "Nemotron 3.5 Super VL", note: "Vision reasoning · catalog" },
  { id: "nvidia/riva-translate-4b-instruct-v2", provider: "nvidia", label: "Riva Translate 4B", note: "37 languages · catalog" },
  { id: "poolside/laguna-xs-2.1", provider: "nvidia", label: "Poolside Laguna XS", note: "Agentic coding · catalog" },
  { id: "stepfun-ai/step-5-preview", provider: "nvidia", label: "Step 5 Preview", note: "Multimodal · 1M context · catalog" },
  { id: "z-ai/glm-5.3-flash", provider: "nvidia", label: "GLM 5.3 Flash", note: "Multimodal · tools · catalog" },
] as const;

/**
 * The configured NVIDIA endpoint does not expose a text-to-image model
 * (all images/generations and text-to-image calls return 404).
 * Image generation therefore stays on ZAI until an NVIDIA image endpoint is
 * actually provisioned for this key.
 */
export const IMAGE_MODELS = [
  { id: "zai:auto", provider: "zai", label: "ZAI Web Dev SDK", note: "Current provider" },
  { id: "pollinations:flux", provider: "pollinations", label: "WALLORA Free", note: "Pollinations Flux · no key · rate limited" },
] as const;

export type ModelCapability =
  | "chat"
  | "reasoning"
  | "vision"
  | "coding"
  | "long_context"
  | "fast"
  | "translation"
  | "safety"
  | "embeddings"
  | "reranking"
  | "image_generation"
  | "specialized";

export type CatalogModel = {
  id: string;
  label: string;
  capabilities: ModelCapability[];
  note: string;
  /** Whether the model can be tested with the OpenAI-compatible chat endpoint. */
  chatCompatible: boolean;
};

export const CAPABILITY_GROUPS: { id: ModelCapability; label: string; description: string }[] = [
  { id: "chat", label: "Chat", description: "Text conversation via the OpenAI-compatible endpoint." },
  { id: "reasoning", label: "Reasoning", description: "Multi-step planning, analysis and structured answers." },
  { id: "vision", label: "Vision", description: "Accepts image input for analysis and multimodal prompts." },
  { id: "coding", label: "Coding", description: "Code generation, refactoring and agentic development." },
  { id: "long_context", label: "Long context", description: "Large document or conversation windows." },
  { id: "fast", label: "Fast", description: "Smaller or distilled models for low-latency replies." },
  { id: "translation", label: "Translation", description: "Multilingual translation and localization." },
  { id: "safety", label: "Safety", description: "Moderation, topic control and PII detection." },
  { id: "embeddings", label: "Embeddings", description: "Semantic search and retrieval, not chat generation." },
  { id: "reranking", label: "Reranking", description: "Relevance scoring for retrieval results." },
  { id: "image_generation", label: "Image generation", description: "Text-to-image systems exposed by NVIDIA, not chat models." },
  { id: "specialized", label: "Specialized", description: "Domain-specific NIMs such as video detection or calibration." },
];

/**
 * Full public NVIDIA NIM catalog snapshot (2026-11-22, 33 models). This is
 * capability documentation for the hidden admin panel, not an entitlement
 * list. Model access depends on the configured NVIDIA_API_KEY.
 */
export const NVIDIA_MODEL_CATALOG: CatalogModel[] = [
  { id: "bigcode/starcoder2-15b", label: "StarCoder2 15B", capabilities: ["coding"], note: "Code generation model; completion-style, not a general chat assistant.", chatCompatible: false },
  { id: "fastino/gliner2-pii", label: "GLiNER2 PII", capabilities: ["safety", "specialized"], note: "Extracts PII spans and confidence scores.", chatCompatible: false },
  { id: "google/gemma-3-12b-it", label: "Gemma 3 12B IT", capabilities: ["chat", "vision", "fast"], note: "Multimodal instruction model suitable for vision chat.", chatCompatible: true },
  { id: "google/gemma-3-4b-it", label: "Gemma 3 4B IT", capabilities: ["chat", "vision", "fast"], note: "Small multimodal instruction model for quick replies.", chatCompatible: true },
  { id: "google/gemma-4-31b-it", label: "Gemma 4 31B IT", capabilities: ["chat", "reasoning", "coding"], note: "Dense reasoning model for coding and agentic work.", chatCompatible: true },
  { id: "meta/muse-glimmer-30b", label: "Muse Glimmer 30B", capabilities: ["chat", "vision", "reasoning"], note: "Multimodal reasoning with native tool calling.", chatCompatible: true },
  { id: "minimaxai/minimax-m3.1-flash", label: "MiniMax M3.1 Flash", capabilities: ["chat", "vision", "coding", "fast"], note: "Fast multimodal MoE for coding and agents. Verified on this key.", chatCompatible: true },
  { id: "mistralai/mistral-large-4-1t-a52b", label: "Mistral Large 4", capabilities: ["chat", "vision", "reasoning", "long_context"], note: "Text and image input with reasoning and structured outputs. Verified on this key.", chatCompatible: true },
  { id: "moonshotai/kimi-k3.1-pro", label: "Kimi K3.1 Pro", capabilities: ["chat", "coding", "long_context", "reasoning"], note: "1M-token context for agentic coding and finance.", chatCompatible: true },
  { id: "nvidia/ai-synthetic-video-detector", label: "Synthetic Video Detector", capabilities: ["safety", "specialized"], note: "Detects AI-generated video.", chatCompatible: false },
  { id: "nvidia/cosmos-reason2-8b", label: "Cosmos Reason2 8B", capabilities: ["vision", "reasoning", "specialized"], note: "Physical-world reasoning over video and images.", chatCompatible: false },
  { id: "nvidia/embed-qa-4", label: "Embed QA 4", capabilities: ["embeddings"], note: "Retrieval embeddings.", chatCompatible: false },
  { id: "nvidia/ising-calibration-1.5-31b", label: "Ising Calibration 1.5", capabilities: ["vision", "specialized"], note: "Quantum calibration chart understanding.", chatCompatible: false },
  { id: "nvidia/llama-3.1-nemoguard-8b-topic-control", label: "NemoGuard Topic Control", capabilities: ["safety"], note: "Keeps conversations inside approved topics.", chatCompatible: false },
  { id: "nvidia/llama-3.1-nemotron-safety-guard-8b-v3", label: "Nemotron Safety Guard", capabilities: ["safety"], note: "Multilingual content safety and moderation.", chatCompatible: false },
  { id: "nvidia/llama-3.2-nemoretriever-1b-vlm-embed-v1", label: "NemoRetriever VLM Embed", capabilities: ["embeddings", "vision"], note: "Visual-language retrieval embeddings.", chatCompatible: false },
  { id: "nvidia/llama-3.2-nv-embedqa-1b-v1", label: "EmbedQA 1B", capabilities: ["embeddings"], note: "Question-answering retrieval embeddings.", chatCompatible: false },
  { id: "nvidia/nemotron-3-embed-1b", label: "Nemotron 3 Embed 1B", capabilities: ["embeddings"], note: "Semantic search embeddings.", chatCompatible: false },
  { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", label: "Nemotron 3 Nano Omni", capabilities: ["chat", "vision", "reasoning", "long_context"], note: "Omni-modal reasoning across text, image, video and speech.", chatCompatible: true },
  { id: "nvidia/nemotron-3-ultra-550b-a55b", label: "Nemotron 3 Ultra 550B", capabilities: ["chat", "reasoning", "coding", "long_context"], note: "1M-context hybrid Mamba-Transformer for planning and tools.", chatCompatible: true },
  { id: "nvidia/nemotron-3.5-bolt-e4b", label: "Nemotron 3.5 Bolt E4B", capabilities: ["chat", "reasoning", "fast"], note: "Compact reasoning and tool-calling chat model.", chatCompatible: true },
  { id: "nvidia/nemotron-3.5-content-safety", label: "Nemotron 3.5 Content Safety", capabilities: ["safety", "vision"], note: "Multilingual multimodal unsafe-content detection.", chatCompatible: false },
  { id: "nvidia/nemotron-3.5-embed-1b", label: "Nemotron 3.5 Embed 1B", capabilities: ["embeddings", "vision"], note: "Multimodal document-image retrieval embeddings.", chatCompatible: false },
  { id: "nvidia/nemotron-3.5-embed-8b", label: "Nemotron 3.5 Embed 8B", capabilities: ["embeddings", "vision"], note: "Larger multimodal retrieval embeddings.", chatCompatible: false },
  { id: "nvidia/nemotron-3.5-lightning-30b-a3b", label: "Nemotron 3.5 Lightning", capabilities: ["chat", "reasoning", "fast"], note: "Fast agentic MoE. Verified on this key.", chatCompatible: true },
  { id: "nvidia/nemotron-3.5-super-vl-120b-a12b", label: "Nemotron 3.5 Super VL", capabilities: ["chat", "vision", "reasoning", "coding"], note: "Early-access multimodal reasoning and coding model.", chatCompatible: true },
  { id: "nvidia/nv-embedqa-mistral-7b-v2", label: "EmbedQA Mistral 7B", capabilities: ["embeddings"], note: "Retrieval embeddings.", chatCompatible: false },
  { id: "nvidia/nvclip", label: "NVCLIP", capabilities: ["embeddings", "vision"], note: "Image-text embeddings.", chatCompatible: false },
  { id: "nvidia/riva-translate-4b-instruct-v2", label: "Riva Translate 4B", capabilities: ["chat", "translation"], note: "Instruction-tuned translation across 37 languages.", chatCompatible: true },
  { id: "poolside/laguna-xs-2.1", label: "Poolside Laguna XS 2.1", capabilities: ["chat", "coding", "long_context"], note: "Efficient long-horizon agentic coding.", chatCompatible: true },
  { id: "snowflake/arctic-embed-l", label: "Snowflake Arctic Embed L", capabilities: ["embeddings"], note: "Text embeddings.", chatCompatible: false },
  { id: "stepfun-ai/step-5-preview", label: "Step 5 Preview", capabilities: ["chat", "vision", "reasoning", "long_context"], note: "1M-context multimodal MoE with tool calling.", chatCompatible: true },
  { id: "z-ai/glm-5.3-flash", label: "GLM 5.3 Flash", capabilities: ["chat", "vision", "reasoning", "fast"], note: "Multimodal MoE with reasoning and tool calling.", chatCompatible: true },
];

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
    input.textProvider === "pollinations" || textModel.startsWith("pollinations:")
      ? "pollinations"
      : input.textProvider === "nvidia" || textModel.includes("/")
        ? "nvidia"
        : "zai";
  let imageProvider: AIProviderId =
    input.imageProvider === "pollinations" || imageModel.startsWith("pollinations:")
      ? "pollinations"
      : input.imageProvider === "nvidia" || imageModel.includes("/")
        ? "nvidia"
        : "zai";

  // No working NVIDIA image endpoint on this key — keep image generation on
  // ZAI or WALLORA Free (Pollinations).
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
