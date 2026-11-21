import { SiteHeader } from "@/components/wallora/site-header";
import { SiteFooter } from "@/components/wallora/site-footer";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}