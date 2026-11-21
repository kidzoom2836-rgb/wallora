import { AppHeader } from "@/components/landing/app-header";
import { AuthDialog } from "@/components/landing/auth-dialog";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

/**
 * Shared layout for all authenticated/app pages.
 * Includes the navigation header and global dialogs.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />
      <main className="flex-1">{children}</main>
      <ServiceWorkerRegister />
      <AuthDialog />
    </div>
  );
}
