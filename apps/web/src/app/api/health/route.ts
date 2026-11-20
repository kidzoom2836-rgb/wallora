import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok", service: "wallora-web", timestamp: new Date().toISOString() });
}
