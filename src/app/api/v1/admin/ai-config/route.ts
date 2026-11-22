import { NextRequest, NextResponse } from "next/server";

import { requireRole, ROLES } from "@/lib/auth-helpers";
import {
  CAPABILITY_GROUPS,
  DEFAULT_AI_CONFIG,
  getAIConfig,
  IMAGE_MODELS,
  NVIDIA_MODEL_CATALOG,
  nvidiaKeyConfigured,
  saveAIConfig,
  TEXT_MODELS,
  type AIConfig,
} from "@/lib/ai/admin-config";

/**
 * GET  /api/v1/admin/ai-config — read the active text/image provider config.
 * PATCH /api/v1/admin/ai-config — change model/provider settings.
 *
 * Super admin only. Never returns the NVIDIA key — only whether it is set.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireRole(ROLES.SUPER_ADMIN);
  if (!auth.ok) return auth.response;

  const config = await getAIConfig();
  return NextResponse.json({
    data: {
      ...config,
      nvidiaKeyConfigured: nvidiaKeyConfigured(),
      textModels: TEXT_MODELS,
      imageModels: IMAGE_MODELS,
      nvidiaCatalog: NVIDIA_MODEL_CATALOG,
      capabilityGroups: CAPABILITY_GROUPS,
      defaults: DEFAULT_AI_CONFIG,
    },
  });
}

const ALLOWED: (keyof AIConfig)[] = [
  "textProvider",
  "textModel",
  "imageProvider",
  "imageModel",
  "nvidiaBaseUrl",
  "temperature",
  "maxTokens",
];

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(ROLES.SUPER_ADMIN);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Expected a JSON object." } },
      { status: 400 },
    );
  }

  const patch: Partial<AIConfig> = {};
  for (const key of ALLOWED) {
    const value = (body as Record<string, unknown>)[key];
    if (value !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (patch as any)[key] = value;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "No updatable fields provided." } },
      { status: 400 },
    );
  }

  const config = await saveAIConfig(patch, auth.session.user.id);
  return NextResponse.json({ data: { ...config, nvidiaKeyConfigured: nvidiaKeyConfigured() } });
}
