import Link from "next/link";

import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import {
  APP_APK_URL,
  APP_VERSION,
  DownloadAppSection,
} from "@/components/landing/download-app-section";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    title: "Download the APK",
    body: "Tap the download button below. The file is the latest Android debug build of WALLORA.",
  },
  {
    title: "Allow installation",
    body: "When Android asks, allow installs from this source. This is required for direct APK installs outside the Play Store.",
  },
  {
    title: "Register or sign in",
    body: "Create an account here on the website or inside the app. Both use the same WALLORA account system.",
  },
];

export default function GetAppPage() {
  return (
    <div id="top" className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1 pt-16">
        <DownloadAppSection />

        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Install guide
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-foreground">
              Get WALLORA on Android
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-secondary-text">
              Version {APP_VERSION} · direct APK download · shared account with the website.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <article key={step.title} className="rounded-2xl border border-border bg-surface p-6">
                <span className="flex size-8 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-sm font-bold text-primary">
                  {index + 1}
                </span>
                <h2 className="mt-4 font-display text-base font-semibold text-foreground">
                  {step.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-secondary-text">{step.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-border bg-surface/60 p-6 text-center">
            <p className="text-sm text-foreground">
              Already have a WALLORA account? Sign in in the app with the same email and password.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                <a href={APP_APK_URL} target="_blank" rel="noopener noreferrer">
                  Download APK
                </a>
              </Button>
              <Button variant="outline" className="border-border text-foreground hover:bg-surface" asChild>
                <Link href="/register">Create account on web</Link>
              </Button>
              <Button variant="ghost" className="text-secondary-text hover:text-foreground" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
