import { NextResponse } from "next/server";

import { AI_MODES } from "@/lib/ai/modes";

/**
 * GET /api/v1/ai/modes
 * Returns all available WALLORA AI modes (public — no auth required).
 */
export async function GET() {
  return NextResponse.json({
    data: AI_MODES.map((m) => ({
      id: m.id,
      name: m.name,
      shortName: m.shortName,
      description: m.description,
      icon: m.icon.name,
      capabilities: m.capabilities,
      starterPrompts: m.starterPrompts,
    })),
  });
}
