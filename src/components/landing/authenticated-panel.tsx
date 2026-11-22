"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  MessageSquare,
  Wand2,
  FolderKanban,
  LayoutDashboard,
  Shield,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WalloraMonogram } from "@/components/brand/wallora-logo";

const WORKSPACE = [
  { icon: LayoutDashboard, label: "Discover", detail: "Real wallpapers", href: "/discover" },
  { icon: MessageSquare, label: "AI Chat", detail: "Your creative assistant", href: "/ai" },
  { icon: Wand2, label: "AI Studio", detail: "Generate artwork", href: "/studio" },
  { icon: FolderKanban, label: "Projects", detail: "Build your showcase", href: "/projects" },
];

/**
 * Renders a personalized welcome panel for authenticated users.
 * Hidden entirely for anonymous visitors (the landing page is unchanged).
 * Only visible after a successful sign-in or registration.
 */
export function AuthenticatedPanel() {
  const { data: session, status } = useSession();

  if (status !== "authenticated" || !session?.user) return null;

  const user = session.user;

  return (
    <AnimatePresence>
      <motion.section
        id="account"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden border-b border-border bg-surface/60"
        aria-labelledby="account-heading"
      >
        <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Identity */}
            <div className="flex items-center gap-4">
              <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-raised">
                <WalloraMonogram className="h-9 w-9" />
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                </span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2
                    id="account-heading"
                    className="font-display text-xl font-semibold text-foreground"
                  >
                    Welcome, {user.name || user.username || "member"}
                  </h2>
                  <Badge
                    variant="outline"
                    className="border-primary/30 bg-primary/10 text-[10px] capitalize text-primary"
                  >
                    <Shield className="mr-1 h-2.5 w-2.5" />
                    {user.role}
                  </Badge>
                </div>
                <p className="mt-0.5 text-sm text-secondary-text">
                  Signed in as{" "}
                  <span className="font-medium text-foreground">
                    {user.email}
                  </span>
                  {user.username && (
                    <>
                      {" "}· @{user.username}
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Account active
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs text-secondary-text">
                Web + Android · live
              </span>
            </div>
          </div>

          {/* Your workspace */}
          <div className="mt-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-secondary-text">
              Your creative workspace
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {WORKSPACE.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-raised/60 p-4 text-left transition-colors hover:border-primary/40"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">
                        {item.label}
                      </span>
                      <span className="block text-xs text-secondary-text">{item.detail}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-secondary-text transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/60 p-4">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            <p className="flex-1 text-sm text-secondary-text">
              Your account is live. Build a showcase, publish a project and grow your tier.
            </p>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
              <Link href="/projects">Open Projects</Link>
            </Button>
          </div>
        </div>
      </motion.section>
    </AnimatePresence>
  );
}
