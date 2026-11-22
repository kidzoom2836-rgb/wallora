import Link from "next/link";

import {
  ArrowRightIcon,
  CheckCircleIcon,
  DownloadIcon,
  SmartphoneIcon,
} from "@/components/icons/wallora-icons";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "./section-heading";

export const APP_APK_URL =
  "https://expo.dev/artifacts/eas/-dpwID8-fxszLYSlY82Y6knQWs-x92qxt3zMQlulnD8.apk";
export const APP_VERSION = "1.0.0";

const HIGHLIGHTS = [
  "One WALLORA account on web and Android",
  "Discover, chat, create and publish on the move",
  "Native downloads saved to your WALLORA gallery album",
];

export function DownloadAppSection() {
  return (
    <section id="get-app" className="relative border-y border-border bg-surface/40 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <SectionHeading
              eyebrow="WALLORA mobile"
              title={<>Your creative world, in your pocket</>}
              subtitle="Download the Android app and use the same account you create here on the website. Registration, sign-in, uploads, favorites and AI all stay in sync."
            />

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold-glow" asChild>
                <a href={APP_APK_URL} target="_blank" rel="noopener noreferrer">
                  <DownloadIcon size={16} className="mr-2" />
                  Download Android APK
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-border bg-transparent text-foreground hover:bg-surface hover:text-foreground"
                asChild
              >
                <Link href="/get-app">
                  Install guide
                  <ArrowRightIcon size={16} className="ml-2" />
                </Link>
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-secondary-text">
              <span>Android debug build</span>
              <span className="hidden h-3 w-px bg-border sm:block" />
              <span>Version {APP_VERSION}</span>
              <span className="hidden h-3 w-px bg-border sm:block" />
              <span>No separate app account</span>
            </div>

            <ul className="mt-8 space-y-3">
              {HIGHLIGHTS.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-secondary-text">
                  <CheckCircleIcon size={16} className="mt-0.5 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-6 rounded-[3rem] bg-primary/10 blur-3xl" aria-hidden />
            <div className="relative overflow-hidden rounded-[2rem] border border-border bg-background p-3 shadow-premium ring-gold">
              <div className="rounded-[1.5rem] border border-border bg-surface p-5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-semibold tracking-[0.18em] text-foreground">
                    WALLORA
                  </span>
                  <SmartphoneIcon size={16} className="text-primary" />
                </div>
                <div className="mt-5 aspect-[9/14] overflow-hidden rounded-2xl border border-border bg-wallora-radial">
                  <img
                    src="/showcase/collection-cyberdawn.jpg"
                    alt="WALLORA mobile app preview"
                    className="h-full w-full object-cover opacity-90"
                    loading="lazy"
                  />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">Cyber Dawn</p>
                    <p className="text-[11px] text-secondary-text">Curated for your device</p>
                  </div>
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                    <Link href="/discover">Explore</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
