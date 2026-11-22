import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { OfflineBanner } from "@/components/pwa/offline-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Resolve the canonical site URL from env so metadata / OG / canonical URLs
// are correct on Vercel (set NEXTAUTH_URL to the production domain there) and
// in preview deployments (VERCEL_URL). Falls back to localhost for dev.
const SITE_URL =
  process.env.NEXTAUTH_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "WALLORA — Discover. Chat. Imagine. Create. Share. Earn.",
    template: "%s · WALLORA",
  },
  description:
    "WALLORA is an AI-powered creative ecosystem. Discover inspiring visuals, talk to AI, generate original artwork, and build your creative world.",
  keywords: [
    "WALLORA",
    "AI art",
    "wallpapers",
    "creative studio",
    "image generation",
    "AI chat",
    "design tools",
    "creative platform",
  ],
  authors: [{ name: "WALLORA" }],
  creator: "WALLORA",
  applicationName: "WALLORA",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/wallora-icon.svg", type: "image/svg+xml" },
    ],
    apple: "/wallora-icon.svg",
  },
  openGraph: {
    title: "WALLORA — Your imagination deserves a place to live.",
    description:
      "Discover inspiring visuals, talk to AI, create original artwork and build your creative world.",
    url: SITE_URL,
    siteName: "WALLORA",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "WALLORA — Your imagination deserves a place to live.",
    description:
      "An AI-powered creative ecosystem. Discover. Chat. Imagine. Create. Share. Earn.",
  },
  robots: {
    index: true,
    follow: true,
  },
  category: "creative",
};

export const viewport: Viewport = {
  themeColor: "#0B0C0F",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          <OfflineBanner />
          {children}
        </Providers>
        <ServiceWorkerRegister />
        <Toaster />
        <SonnerToaster theme="dark" position="bottom-right" richColors />
      </body>
    </html>
  );
}
