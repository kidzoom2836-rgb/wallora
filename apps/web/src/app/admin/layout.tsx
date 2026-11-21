import Link from "next/link";
import { Logo } from "@/components/wallora/logo";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

const adminNav = [
  "Overview", "Users", "Creators", "Wallpapers", "Moderation", "AI Providers",
  "AI Models", "Usage", "Plans", "Payments", "Earnings", "Reports", "Settings", "Audit Logs",
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 border-r border-border/60 bg-card/40 md:flex md:flex-col">
        <div className="flex h-16 items-center border-b border-border/60 px-6">
          <Logo />
          <span className="ml-2 rounded-md bg-primary/15 px-2 py-0.5 text-xs text-primary">Admin</span>
        </div>
        <nav className="flex-1 space-y-1 p-3 text-sm">
          {adminNav.map((n) => {
            const slug = n.toLowerCase().replace(/ /g, "-");
            const href = n === "Overview" ? "/admin" : `/admin/${slug}`;
            return (
              <Link
                key={n}
                href={href}
                className="block rounded-lg px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                {n}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border/60 px-6">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="font-medium">Administration</span>
          </div>
          <Button variant="outline" size="sm" render={<Link href="/dashboard" />}>Back to app</Button>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}