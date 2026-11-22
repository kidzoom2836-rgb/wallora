import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";

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
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const model = typeof body?.model === "string" ? body.model : DEFAULT_MODEL;

  const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `NVIDIA error: ${err}` }, { status: res.status });
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  return NextResponse.json({ content, model, usage: data?.usage });
}
