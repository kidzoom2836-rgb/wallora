import Link from "next/link";
import { Logo } from "./logo";

const cols = [
  {
    title: "Product",
    links: [
      { href: "/discover", label: "Discover" },
      { href: "/ai", label: "AI Chat" },
      { href: "/studio", label: "Studio" },
      { href: "/marketplace", label: "Marketplace" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <Logo />
            <p className="text-sm text-muted-foreground">
              Your imagination deserves a place to live.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="mb-3 text-sm font-semibold">{c.title}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-border/60 pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} WALLORA. All rights reserved.
        </div>
      </div>
    </footer>
  );
}