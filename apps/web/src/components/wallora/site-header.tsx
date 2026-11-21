"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";

const nav = [
  { href: "/discover", label: "Discover" },
  { href: "/ai", label: "AI Chat" },
  { href: "/studio", label: "Studio" },
  { href: "/community", label: "Community" },
  { href: "/marketplace", label: "Marketplace" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <Logo />
        <nav className="hidden items-center gap-6 md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm text-muted-foreground transition hover:text-foreground">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="hidden md:inline-flex" nativeButton={false} render={<Link href="/login" />}>
            Sign in
          </Button>
          <Button nativeButton={false} render={<Link href="/register" />}>Get started</Button>
        </div>
      </div>
    </header>
  );
}
