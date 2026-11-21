"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useWaitlistDialog } from "@/stores/waitlist";
import { EXAMPLE_PROMPTS } from "@/lib/landing-data";
import { SparklesIcon, WandIcon, ImageIcon, ArrowRightIcon } from "@/components/icons/wallora-icons";

export function Hero() {
  const [prompt, setPrompt] = React.useState("");
  const router = useRouter();
  const openWaitlist = useWaitlistDialog((s) => s.openWith);
  const { data: session, status } = useSession();
  const authenticated = status === "authenticated" && !!session?.user;

  const handleImagine = (e: React.FormEvent) => {
    e.preventDefault();
    if (authenticated) {
      router.push("/ai");
    } else {
      router.push("/register");
    }
  };

  return (
    <section
      className="relative overflow-hidden bg-wallora-radial"
      aria-labelledby="hero-heading"
    >
      {/* Grain + gradient backdrop */}
      <div className="absolute inset-0 bg-wallora-grain opacity-60" aria-hidden />
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
        aria-hidden
      />

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6 sm:pb-28 sm:pt-32 lg:px-8 lg:pb-32 lg:pt-40">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          {/* Left — copy + input */}
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-secondary-text backdrop-blur"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              AI-powered creative ecosystem
            </motion.div>

            <motion.h1
              id="hero-heading"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
            >
              Your{" "}
              <span className="gold-gradient-text">imagination</span>
              <br className="hidden sm:block" /> deserves a place to live.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="mt-5 max-w-xl text-base leading-relaxed text-secondary-text sm:text-lg"
            >
              Discover inspiring visuals, talk to AI, create original artwork and
              build your creative world. WALLORA brings discovery, conversation and
              creation into one premium ecosystem.
            </motion.p>

            {/* Main AI creation input */}
            <motion.form
              onSubmit={handleImagine}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8"
              aria-label="Main AI creation input"
            >
              <div className="group relative rounded-2xl border border-border bg-surface/80 p-2 shadow-premium backdrop-blur transition-colors focus-within:border-primary/50 focus-within:ring-gold">
                <div className="flex items-start gap-2">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={2}
                    placeholder="Describe what you want to create… e.g. a futuristic luxury bedroom with black walls and golden lighting"
                    className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-secondary-text/80 focus:outline-none"
                    aria-label="Describe what you want to create"
                  />
                  <Button
                    type="submit"
                    className="mt-0.5 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold-glow"
                  >
                    <WandIcon size={16} className="mr-1.5" />
                    Imagine
                  </Button>
                </div>
              </div>
              <p className="mt-2.5 px-1 text-xs text-secondary-text">
                {authenticated
                  ? "WALLORA AI is live. Describe your idea and chat with the Creative Assistant."
                  : "Sign in to chat with WALLORA AI — nine creative modes, real responses."}
              </p>
            </motion.form>

            {/* Example prompt chips */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="mt-5 flex flex-wrap gap-2"
            >
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setPrompt(example);
                    openWaitlist("studio");
                  }}
                  className="max-w-[280px] truncate rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-secondary-text transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {example.length > 48 ? `${example.slice(0, 48)}…` : example}
                </button>
              ))}
            </motion.div>

            {/* Primary actions */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.36, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold-glow"
                onClick={() => router.push(authenticated ? "/ai" : "/register")}
              >
                <SparklesIcon size={16} className="mr-2" />
                {authenticated ? "Chat with AI" : "Start creating"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-border bg-transparent text-foreground hover:bg-surface hover:text-foreground"
                asChild
              >
                <Link href="/discover">
                  Explore artwork
                  <ArrowRightIcon size={16} className="ml-2" />
                </Link>
              </Button>
            </motion.div>
          </div>

          {/* Right — hero showcase image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative order-first lg:order-last"
          >
            <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-premium ring-gold">
              <div className="aspect-[16/9] overflow-hidden">
                <img
                  src="/showcase/hero.jpg"
                  alt="WALLORA concept showcase — a futuristic luxury bedroom with warm golden accent lighting overlooking a neon city skyline"
                  className="h-full w-full object-cover"
                  loading="eager"
                  fetchPriority="high"
                />
              </div>
              {/* Floating AI badge */}
              <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium text-secondary-text backdrop-blur">
                <ImageIcon size={12} className="text-primary" />
                AI concept · showcase
              </div>
              {/* Floating caption */}
              <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
                <div className="rounded-xl border border-border bg-background/85 px-3 py-2 backdrop-blur">
                  <p className="text-xs font-medium text-foreground">
                    Futuristic luxury bedroom
                  </p>
                  <p className="text-[11px] text-secondary-text">
                    Generated by WALLORA · cinematic preset
                  </p>
                </div>
                <div className="hidden rounded-xl border border-border bg-background/85 px-3 py-2 text-right backdrop-blur sm:block">
                  <p className="text-[11px] font-medium text-primary">16:10</p>
                  <p className="text-[11px] text-secondary-text">1440 × 900</p>
                </div>
              </div>
            </div>

            {/* Decorative gradient orb */}
            <div
              className="absolute -right-12 -top-12 -z-10 h-48 w-48 rounded-full bg-primary/20 blur-3xl"
              aria-hidden
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
