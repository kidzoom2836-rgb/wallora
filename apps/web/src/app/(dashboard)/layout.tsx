"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/wallora/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Compass,
  Sparkles,
  FolderKanban,
  Library,
  Users,
  ShoppingBag,
  Bell,
  Settings,
  Menu,
  Search,
  Coins,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/ai", label: "AI Chat", icon: Sparkles },
  { href: "/studio", label: "Studio", icon: Sparkles },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/my-space", label: "My Space", icon: Library },
  { href: "/collections", label: "Collections", icon: Library },
  { href: "/community", label: "Community", icon: Users },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [isPending, session, router]);

  if (isPending) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!session) return null;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border/60 bg-card/40 md:flex md:flex-col">
        <div className="flex h-16 items-center border-b border-border/60 px-6">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <NavList />
        </div>
        <div className="border-t border-border/60 p-4">
          <Link href="/profile/me" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <User className="h-4 w-4" /> Profile
          </Link>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur md:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-16 items-center border-b border-border/60 px-6">
                <Logo />
              </div>
              <div className="p-4">
                <NavList onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search wallpapers, creators, projects…"
              className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-4 text-sm outline-none ring-primary/40 focus:ring-2"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden gap-1 sm:inline-flex">
              <Coins className="h-4 w-4 text-primary" /> 0 credits
            </Button>
            <Button variant="ghost" size="icon" render={<Link href="/notifications" />}>
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" render={<Link href="/profile/me" />}>
              <User className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-border/60 bg-background/95 backdrop-blur md:hidden">
          {[
            { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
            { href: "/discover", icon: Compass, label: "Discover" },
            { href: "/ai", icon: Sparkles, label: "AI" },
            { href: "/studio", icon: Sparkles, label: "Studio" },
            { href: "/my-space", icon: Library, label: "Library" },
          ].map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex flex-1 flex-col items-center gap-1 py-2 text-xs text-muted-foreground"
            >
              <n.icon className="h-5 w-5" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="h-16 md:hidden" />
      </div>
    </div>
  );
}