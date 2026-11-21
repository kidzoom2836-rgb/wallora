import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/wallora/site-header";
import { SiteFooter } from "@/components/wallora/site-footer";
import {
  Sparkles,
  Image as ImageIcon,
  Wand2,
  Layers,
  ArrowRight,
  Palette,
  MessageSquare,
  FolderKanban,
} from "lucide-react";

const categories = [
  "Nature", "Technology", "Cars", "Architecture", "Minimalism",
  "Luxury", "Abstract", "Gaming", "Interior", "Fashion",
];

const tools = [
  { icon: Wand2, title: "AI Studio", desc: "Generate original artwork from text prompts." },
  { icon: ImageIcon, title: "Photo Studio", desc: "Enhance, crop and refine images." },
  { icon: Palette, title: "Brand Studio", desc: "Build brand concepts and moodboards." },
  { icon: Layers, title: "Design Studio", desc: "Posters, flyers and social graphics." },
  { icon: MessageSquare, title: "AI Chat", desc: "Converse with your creative assistant." },
  { icon: FolderKanban, title: "Projects", desc: "Organize assets and ideas in one place." },
];

const steps = [
  { n: "01", title: "Imagine", desc: "Describe what you want in your own words." },
  { n: "02", title: "Create", desc: "WALLORA AI picks the right tool and generates it." },
  { n: "03", title: "Refine", desc: "Iterate, edit and perfect your creation." },
  { n: "04", title: "Share", desc: "Publish to your profile or sell in the marketplace." },
];

const faqs = [
  { q: "Is WALLORA free to use?", a: "Yes. Free users get a daily allowance of AI operations. Upgrade for more." },
  { q: "Can I sell my creations?", a: "Yes. Creators can publish digital products and earn from sales." },
  { q: "Which AI models power WALLORA?", a: "NVIDIA NIM hosted models, selected for capability and quality." },
  { q: "Does WALLORA work offline?", a: "The web app is a PWA with offline support for saved content." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(215,184,121,0.12),transparent_60%)]" />
          <div className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> AI-powered creative ecosystem
              </span>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl">
                Your imagination deserves a place to live.
              </h1>
              <p className="mt-5 text-base text-muted-foreground md:text-lg">
                Discover inspiring visuals, talk to AI, create original artwork and build your creative world.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" render={<Link href="/register" />}>
                    Start creating <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                <Button size="lg" variant="outline" render={<Link href="/discover" />}>Explore artwork</Button>
              </div>
              <div className="mt-10 flex items-center justify-center gap-3">
                <input
                  type="text"
                  placeholder="Describe what you want to create…"
                  className="w-full max-w-xl rounded-full border border-border bg-card px-5 py-3 text-sm outline-none ring-primary/40 transition focus:ring-2"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Featured artwork */}
        <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-2xl font-semibold">Featured artwork</h2>
            <Link href="/discover" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="aspect-[3/4] bg-gradient-to-br from-muted to-card" />
                <div className="space-y-1 p-3">
                  <p className="text-sm font-medium">Featured piece {i}</p>
                  <p className="text-xs text-muted-foreground">by creator</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sign in to see personalized recommendations.
          </p>
        </section>

        {/* Categories */}
        <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <h2 className="mb-6 text-2xl font-semibold">Explore categories</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c}
                href={`/discover?category=${c.toLowerCase()}`}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm transition hover:border-primary/60 hover:text-primary"
              >
                {c}
              </Link>
            ))}
          </div>
        </section>

        {/* AI Studio intro */}
        <section className="border-y border-border/60 bg-card/30">
          <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
            <div className="grid gap-10 md:grid-cols-2 md:items-center">
              <div>
                <h2 className="text-3xl font-semibold">AI Studio</h2>
                <p className="mt-4 text-muted-foreground">
                  Turn a sentence into a visual. Choose a style, set an aspect ratio, and generate
                  original artwork using NVIDIA NIM hosted models.
                </p>
                <Button className="mt-6" render={<Link href="/studio" />}>Open Studio</Button>
              </div>
              <div className="aspect-video rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-muted" />
            </div>
          </div>
        </section>

        {/* Tools */}
        <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <h2 className="mb-8 text-2xl font-semibold">Creative tools</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((t) => (
              <div key={t.title} className="rounded-xl border border-border bg-card p-5 transition hover:border-primary/40">
                <t.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-semibold">{t.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-border/60 bg-card/30">
          <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
            <h2 className="mb-8 text-2xl font-semibold">How WALLORA works</h2>
            <div className="grid gap-6 md:grid-cols-4">
              {steps.map((s) => (
                <div key={s.n} className="rounded-xl border border-border bg-card p-5">
                  <span className="text-sm font-mono text-primary">{s.n}</span>
                  <h3 className="mt-2 font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trending creators */}
        <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <h2 className="mb-6 text-2xl font-semibold">Trending creators</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-muted" />
                <p className="mt-3 text-sm font-medium">Creator {i}</p>
                <p className="text-xs text-muted-foreground">0 followers</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Creator profiles launch soon.</p>
        </section>

        {/* Marketplace preview */}
        <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold">Marketplace</h2>
            <Link href="/marketplace" className="text-sm text-primary hover:underline">Browse</Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="aspect-square bg-gradient-to-br from-muted to-card" />
                <div className="p-3">
                  <p className="text-sm font-medium">Wallpaper pack {i}</p>
                  <p className="text-xs text-muted-foreground">$0.00</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Plans */}
        <section className="border-y border-border/60 bg-card/30">
          <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
            <h2 className="mb-8 text-center text-2xl font-semibold">Plans</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { name: "Free", price: "$0", desc: "Daily AI allowance and access to the library." },
                { name: "WALLORA Plus", price: "Coming soon", desc: "Larger monthly allowance and premium features." },
                { name: "Creator Pro", price: "Coming soon", desc: "Higher limits and marketplace tools." },
              ].map((p) => (
                <div key={p.name} className="rounded-xl border border-border bg-card p-6">
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="mt-2 text-2xl font-semibold text-primary">{p.price}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Pricing finalized in Phase 9.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-16 md:px-6">
          <h2 className="mb-6 text-2xl font-semibold">FAQ</h2>
          <div className="space-y-4">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-medium">{f.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-4 py-16 text-center md:px-6">
          <h2 className="text-3xl font-semibold">Ready to create?</h2>
          <Button size="lg" className="mt-6" render={<Link href="/register" />}>Start creating</Button>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}