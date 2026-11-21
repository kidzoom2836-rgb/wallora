import ZAI from "z-ai-web-dev-sdk";

import { getStorage } from "@/lib/storage";
import { getAIConfig } from "./admin-config";
import { generateNvidiaImage } from "./nvidia";
import { getPreset } from "./presets";

/**
 * WALLORA image generation service.
 *
 * Wraps the configured image provider, stores the output via the storage
 * adapter, and returns the public URL + metadata. The active provider/model
 * is chosen in the hidden /adminkenya control panel.
 */

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export type GenerateImageParams = {
  prompt: string;
  size: string; // e.g. "1024x1024"
  stylePreset: string;
};

export type GenerateImageResult = {
  objectKey: string;
  publicUrl: string;
  width: number;
  height: number;
  fileSize: number;
  format: string;
  provider: string;
  model: string;
};

/**
 * Generate an image, store it, and return the public URL + metadata.
 * Throws on any failure — the caller handles credit refund.
 */
export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
  const { prompt, size, stylePreset } = params;

  const preset = getPreset(stylePreset);
  const finalPrompt = preset.modifier
    ? `${prompt}, ${preset.modifier}`
    : prompt;

  const config = await getAIConfig();
  const useNvidia =
    config.imageProvider === "nvidia" ||
    config.imageModel.includes("/");

  let buffer: Buffer;
  if (useNvidia) {
    buffer = await generateNvidiaImage({ prompt: finalPrompt, size });
  } else {
    const zai = await getZAI();
    const response = await zai.images.generations.create({
      prompt: finalPrompt,
      size: size as "1024x1024" | "768x1344" | "864x1152" | "1344x768" | "1152x864" | "720x1440",
    });
    const imageBase64 = response.data[0]?.base64;
    if (!imageBase64) throw new Error("Image generation returned no data.");
    buffer = Buffer.from(imageBase64, "base64");
  }

  const [widthStr, heightStr] = size.split("x");
  const width = parseInt(widthStr, 10) || 1024;
  const height = parseInt(heightStr, 10) || 1024;

  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  const objectKey = `gen/${timestamp}-${random}.jpg`;

  const storage = getStorage();
  await storage.putObject(objectKey, buffer, "image/jpeg");
  const publicUrl = storage.getPublicUrl(objectKey);

  return {
    objectKey,
    publicUrl,
    width,
    height,
    fileSize: buffer.length,
    format: "jpg",
    provider: useNvidia ? "nvidia" : "zai",
    model: useNvidia ? config.imageModel : "default",
  };
}

/**
 * Estimate the credit cost for a generation based on size.
 * Larger images cost more credits.
 */
export function getGenerationCost(size: string): number {
  const [w, h] = size.split("x").map((n) => parseInt(n, 10));
  const pixels = (w ?? 1024) * (h ?? 1024);
  return Math.max(5, Math.round(5 * (pixels / (1024 * 1024))));
}
