import { getAIConfig } from "@/lib/ai/admin-config";
import { getConfiguredAIProvider } from "@/lib/ai/provider";

/**
 * WALLORA site generation.
 *
 * Produces a single self-contained HTML document (inline CSS + JS, no external
 * dependencies) so it can be previewed in a sandboxed iframe and hosted from
 * StoredBlob without a separate build/deploy pipeline.
 */

export const SITE_STAGES = [
  "Understanding the brief",
  "Planning pages and structure",
  "Writing the interface",
  "Styling and responsive layout",
  "Adding interactions",
  "Polishing the details",
] as const;

// Keep this SHORT and free of backticks around HTML tags — the fast NVIDIA
// reasoning model echoes long prompts back into its output when they contain
// literal tag examples. This prompt produced clean, complete documents.
const SYSTEM_PROMPT = `You are WALLORA Builder. Output ONE complete self-contained HTML document. Start with <!DOCTYPE html> and end with </html>. No markdown, no commentary. Keep under 350 lines. Dark premium design, inline CSS and JS, real interactions, responsive layout, accessible forms, no external resources, no emoji.`;

const FAST_SITE_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";

function extractHtml(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```(?:html|htm|xml)?\s*\n/i, "").replace(/\n```\s*$/i, "");
  const start = text.search(/<!DOCTYPE html>/i);
  if (start > 0) text = text.slice(start);
  const end = text.toLowerCase().lastIndexOf("</html>");
  if (end !== -1) return text.slice(0, end + "</html>".length).trim();

  // The model sometimes hits the token limit mid-document. Repair it so the
  // preview still renders instead of throwing the whole build away.
  const lower = text.toLowerCase();
  if (!lower.includes("<html")) {
    text = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' + text;
  }
  if (!text.toLowerCase().includes("</body>")) text += "\n</body>";
  return (text + "\n</html>").trim();
}

function deriveTitle(prompt: string): string {
  const clean = prompt
    .replace(/^(build|create|make|design|generate)\s+(me\s+)?(a|an|the)?\s*/i, "")
    .replace(/[.!?].*$/, "")
    .trim();
  const words = clean.split(/\s+/).slice(0, 6).join(" ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "WALLORA Site";
}

/** The general chat model is often too slow for long HTML output. Use the
 * verified-fast NVIDIA model for site generation when a key is configured. */
async function fastGenerate(input: {
  systemPrompt: string;
  userContent: string;
}): Promise<string | null> {
  const key = process.env.NVIDIA_API_KEY?.trim();
  if (!key) return null;
  const config = await getAIConfig();
  try {
    const res = await fetch(`${config.nvidiaBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: FAST_SITE_MODEL,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userContent },
        ],
        temperature: 0.35,
        // 8k tokens finishes in ~30s; 16k caused Vercel function timeouts under
        // load. extractHtml() repairs truncated output if the limit is hit.
        max_tokens: 8192,
        stream: false,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const msg = json?.choices?.[0]?.message ?? {};
    return (msg.content || msg.reasoning_content || "").trim() || null;
  } catch {
    return null;
  }
}

export async function generateSiteHtml(input: {
  prompt: string;
  currentHtml?: string;
  instruction?: string;
}): Promise<{ html: string; title: string; model: string }> {
  const userContent = input.currentHtml
    ? `Edit the existing site below according to this instruction:\n\nINSTRUCTION: ${input.instruction ?? input.prompt}\n\nEXISTING HTML:\n${input.currentHtml.slice(0, 14000)}`
    : `Build a complete website for this brief:\n\n${input.prompt}`;

  let content = await fastGenerate({ systemPrompt: SYSTEM_PROMPT, userContent });
  let model = FAST_SITE_MODEL;

  if (!content) {
    const provider = await getConfiguredAIProvider();
    const config = await getAIConfig();
    const result = await provider.generateText({
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
      maxTokens: 4096,
    });
    content = result.content;
    model = config.textModel;
  }

  const html = extractHtml(content);
  if (html.length < 600 || !html.toLowerCase().includes("<body")) {
    throw new Error("The model returned an incomplete document. Try again.");
  }

  return {
    html,
    title: input.currentHtml ? deriveTitle(input.instruction ?? input.prompt) : deriveTitle(input.prompt),
    model,
  };
}
