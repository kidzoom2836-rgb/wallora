import { getSiteBySlug } from "@/lib/sites/store";

export const dynamic = "force-dynamic";

/** Public hosted site — returns the generated document directly. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site || !site.published) {
    return new Response("Site not found.", { status: 404 });
  }
  return new Response(site.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
