import { getConfiguredAIProvider } from "@/lib/ai/provider";
import { getAIConfig } from "@/lib/ai/admin-config";

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

Output ONE complete, self-contained HTML document and NOTHING else. No markdown fences, no explanations, no commentary before or after.

Hard requirements:
- Start with <!DOCTYPE html> and end with </html>.
- All CSS inside a single <style> tag in <head>. All JavaScript inside a single <script> tag before </body>.
- No external fonts, CDNs, libraries, images from the internet, or network requests. Use system font stacks, inline SVG icons, CSS gradients and emoji-free vector shapes.
- Responsive layout that works on mobile and desktop. Use CSS variables for colors and spacing.
- Dark, premium visual direction by default unless the user asks for light.
- Real interactions: navigation, buttons, forms with validation, modals/toasts, tabs, filters, and localStorage persistence where it makes sense. The result must feel like a working app, not a static mockup.
- Include a small "Built with WALLORA" badge fixed in a corner, styled subtly.
- Accessibility: semantic HTML, labels on inputs, visible focus states, aria-labels on icon buttons.
- Keep the document under 900 lines. It must parse and run standalone in an iframe sandbox.

You are building a real product. Make design decisions instead of asking questions. Prioritize a polished, coherent result.`;

function extractHtml(raw: string): string {
  let text = raw.trim();
  // Strip markdown fences if the model ignored the instruction.
  text = text.replace(/^```(?:html|htm|xml)?\s*\n/i, "").replace(/\n```\s*$/i, "");
  const start = text.search(/<!DOCTYPE html>/i);
  if (start > 0) text = text.slice(start);
  const end = text.toLowerCase().lastIndexOf("</html>");
  if (end !== -1) text = text.slice(0, end + "</html>".length);
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

export async function generateSiteHtml(input: {
  prompt: string;
  currentHtml?: string;
  instruction?: string;
}): Promise<{ html: string; title: string; model: string }> {
  const provider = await getConfiguredAIProvider();
  const config = await getAIConfig();

  const userContent = input.currentHtml
    ? `Edit the existing site below according to this instruction:\n\nINSTRUCTION: ${input.instruction ?? input.prompt}\n\nEXISTING HTML:\n${input.currentHtml.slice(0, 60000)}`
    : `Build a complete website for this brief:\n\n${input.prompt}`;

  const result = await provider.generateText({
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
    maxTokens: 8192,
  });

  const html = extractHtml(result.content);
  if (!html.toLowerCase().includes("<html") || !html.toLowerCase().includes("</html>")) {
    throw new Error("The model did not return a complete HTML document. Try again or use a different text model.");
  }

  return {
    html,
    title: input.currentHtml ? deriveTitle(input.instruction ?? input.prompt) : deriveTitle(input.prompt),
    model: config.textModel,
  };
}
