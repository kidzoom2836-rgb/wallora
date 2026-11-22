import Link from "next/link";
import { Construction } from "lucide-react";
import { SiteHeader } from "@/components/wallora/site-header";
import { SiteFooter } from "@/components/wallora/site-footer";

export default async function CatchAllPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = "/" + slug.join("/");
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <Construction className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Coming soon</h1>
        <p className="text-sm text-muted-foreground">
          The page <span className="font-mono text-foreground">{path}</span> is not available yet. It will be built in a later phase.
        </p>
        <Link href="/" className="text-sm text-primary hover:underline">Back to home</Link>
      </main>
      <SiteFooter />
    </div>
  );
}
