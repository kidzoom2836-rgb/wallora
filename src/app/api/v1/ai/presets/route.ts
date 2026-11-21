import { NextResponse } from "next/server";

import { STYLE_PRESETS, ASPECT_RATIOS } from "@/lib/ai/presets";

/**
 * GET /api/v1/ai/presets
 * Returns style presets and aspect ratios for the AI Studio UI. Public.
 */
export async function GET() {
  return NextResponse.json({
    data: {
      stylePresets: STYLE_PRESETS.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        icon: p.icon.name,
      })),
      aspectRatios: ASPECT_RATIOS,
      generationCost: {
        square: 5,
        portrait: 5,
        landscape: 5,
      },
    },
  });
}
