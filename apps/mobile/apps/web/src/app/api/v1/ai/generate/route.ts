import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const NVIDIA_IMG_ENDPOINT = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "NVIDIA_API_KEY is not configured" }, { status: 503 });
  }

  const body = await req.json();
  const prompt = typeof body?.prompt === "string" ? body.prompt : "";
  if (!prompt.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }
  const width = typeof body?.width === "number" ? body.width : 1024;
  const height = typeof body?.height === "number" ? body.height : 1024;

  const res = await fetch(NVIDIA_IMG_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ prompt, width, height }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `NVIDIA error: ${err}` }, { status: res.status });
  }

  const data = await res.json();
  const b64 = data?.artifacts?.[0]?.base64;
  if (!b64) {
    return NextResponse.json({ error: "No image returned" }, { status: 502 });
  }
  return NextResponse.json({ image: `data:image/jpeg;base64,${b64}` });
}
