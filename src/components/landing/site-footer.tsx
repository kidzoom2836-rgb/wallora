"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, ArrowUpRight, CheckCircle2 } from "lucide-react";

import { WalloraLogo } from "@/components/brand/wallora-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWaitlistDialog } from "@/stores/waitlist";

const PRODUCT_LINKS = [
  { href: "#discover", label: "Discover" },
  { href: "#studio", label: "AI Studio" },
  { href: "#tools", label: "Creative studios" },
  { href: "#collections", label: "Collections" },
  { href: "#marketplace", label: "Marketplace" },
  { href: "#pricing", label: "Pricing" },
  { href: "/get-app", label: "Get Android App" },
];

const COMPANY_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#creators", label: "Founding creators" },
  { href: "#faq", label: "FAQ" },
];

const LEGAL_LINKS = [
  { href: "#", label: "Privacy policy" },
  { href: "#", label: "Terms of service" },
  { href: "#", label: "Copyright policy" },
];

const SOCIALS = [
  { href: "#", label: "X" },
  { href: "#", label: "Instagram" },
  { href: "#", label: "GitHub" },
];

export function SiteFooter() {
  const openWaitlist = useWaitlistDialog((s) => s.openWith);
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = React.useState<string>("");

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("error");
      setError("Enter a valid email address.");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/v1/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, intent: "general" }),
      });
      if (res.status === 201 || res.status === 409) {
        setStatus("success");
        setEmail("");
        return;
      }
      const payload = await res.json();
      setStatus("error");
      setError(payload?.error?.message ?? "Something went wrong.");
    } catch {
      setStatus("error");
      setError("Network error. Please try again.");
    }
  };

  return (
    <footer className="mt-auto border-t border-border bg-surface/60">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]">
          {/* Brand + newsletter */}
          <div className="flex flex-col gap-5">
            <WalloraLogo />
            <p className="max-w-xs text-sm leading-relaxed text-secondary-text">
              An AI-powered creative ecosystem. Discover. Chat. Imagine. Create.
              Share. Earn.
            </p>
            <div className="flex flex-wrap gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-raised/60 px-2.5 py-1 text-xs text-secondary-text transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {s.label}
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          {/* Company */}
          <FooterColumn title="Company" links={COMPANY_LINKS} />
          {/* Legal */}
          <FooterColumn title="Legal" links={LEGAL_LINKS} />

          {/* Newsletter */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary-text">
              Stay in the loop
            </h3>
            <p className="text-sm text-secondary-text">
              Join the waitlist for early access and product updates.
            </p>
            {status === "success" ? (
              <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                You are on the list. Talk soon.
              </div>
            ) : (
              <form onSubmit={subscribe} className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setStatus("idle");
                    }}
                    placeholder="you@example.com"
                    aria-label="Email address"
                    className="border-border bg-background"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={status === "loading"}
                  >
                    {status === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Join"
                    )}
                  </Button>
                </div>
                {status === "error" && (
                  <p className="text-xs text-destructive">{error}</p>
                )}
              </form>
            )}
            <button
              type="button"
              onClick={() => openWaitlist("general")}
              className="mt-1 text-left text-xs text-secondary-text underline-offset-4 hover:text-foreground hover:underline"
            >
              Or join with more detail →
            </button>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-secondary-text">
            © {new Date().getFullYear()} WALLORA. Built with care in phases.
          </p>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-secondary-text">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              All systems live · Web + Android
            </span>
            <Link
              href="#top"
              className="text-xs text-secondary-text underline-offset-4 hover:text-foreground hover:underline"
            >
              Back to top
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary-text">
        {title}
      </h3>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="text-sm text-secondary-text transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
