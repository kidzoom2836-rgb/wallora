import { SiteHeader } from "@/components/landing/site-header";
import { Hero } from "@/components/landing/hero";
import { LiveShowcase } from "@/components/landing/live-showcase";
import { FeaturesShowcase } from "@/components/landing/features-showcase";
import { HowItWorks } from "@/components/landing/how-it-works";
import { DownloadAppSection } from "@/components/landing/download-app-section";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { SiteFooter } from "@/components/landing/site-footer";
import { WaitlistDialog } from "@/components/landing/waitlist-dialog";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

export default function Home() {
  return (
    <div id="top" className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <LiveShowcase />
        <FeaturesShowcase />
        <HowItWorks />
        <DownloadAppSection />
        <Pricing />
        <Faq />
      </main>
      <SiteFooter />
      <WaitlistDialog />
      <ServiceWorkerRegister />
    </div>
  );
}
