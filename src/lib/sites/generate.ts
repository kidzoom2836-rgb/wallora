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

const SYSTEM_PROMPT = `You are the WALLORA Builder, an expert full-stack web engineer and product designer. You build complete, production-quality websites from a short description.

Output ONE complete, self-contained HTML document and NOTHING else. No markdown fences, no explanations, no commentary before or after. Start with <!DOCTYPE html> and end with </html>.

Hard requirements:
- Complete document with inline <style> in <head> and inline <script> before </body>.
- No external fonts, CDNs, libraries, images from the internet, or network requests. Use system font stacks, inline SVG icons, CSS gradients.
- Responsive layout that works on mobile and desktop. Use CSS variables for colors and spacing.
- Dark, premium visual direction by default unless the user asks for light.
- Real interactions: navigation, buttons, forms with validation, modals/toasts, tabs, filters, and localStorage persistence where it makes sense. The result must feel like a working app, not a static mockup.
- Keep the document under 350 lines and under 7000 characters so it finishes reliably.
- Accessibility: semantic HTML, labels on inputs, visible focus states.
- Do not use emoji anywhere.

Make design decisions instead of asking questions. Prioritize a polished, coherent result.`;

const FAST_SITE_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";

function extractHtml(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```(?:html|htm|xml)?\s*\n/i, "").replace(/\n```\s*$/i, "");
  const start = text.search(/<!DOCTYPE html>/i);
  if (start > 0) text = text.slice(start);
  const end = text.toLowerCase().lastIndexOf("</html>");
  if (end !== -1) text = text.slice(0, end + "</html>".length);
  else if (text.toLowerCase().includes("<html")) text += "\n</body></html>";
  return text.trim();
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
        // This model reasons before answering; 8k tokens leaves no room for the
        // actual document. 16k reliably finishes in ~20s.
        max_tokens: 16384,
        stream: false,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(50000),
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
      maxTokens: 8192,
    });
    content = result.content;
    model = config.textModel;
  }

  const html = extractHtml(content);
  if (
    !html.toLowerCase().includes("<html") ||
    !html.toLowerCase().includes("</html>") ||
    !html.toLowerCase().includes("<body") ||
    html.length < 1200
  ) {
    throw new Error("The model returned an incomplete document. Try again.");
  }

  return {
    html,
    title: input.currentHtml ? deriveTitle(input.instruction ?? input.prompt) : deriveTitle(input.prompt),
    model,
  };
}
