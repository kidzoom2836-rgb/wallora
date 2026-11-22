"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";

import { WalloraLogo } from "@/components/brand/wallora-logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { UserMenu } from "@/components/landing/user-menu";
import {
  SearchIcon,
  ChatIcon,
  SparklesIcon,
  StoreIcon,
  FolderIcon,
  DashboardIcon,
  MenuIcon,
  UploadIcon,
  CodeIcon,
  ImageIcon,
} from "@/components/icons/wallora-icons";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/upload", label: "Upload", icon: UploadIcon },
  { href: "/discover", label: "Discover", icon: SearchIcon },
  { href: "/ai", label: "AI Chat", icon: ChatIcon },
  { href: "/studio", label: "Studio", icon: SparklesIcon },
  { href: "/builder", label: "Builder", icon: CodeIcon },
  { href: "/marketplace", label: "Marketplace", icon: StoreIcon },
  { href: "/projects", label: "Projects", icon: FolderIcon },
  { href: "/community", label: "Community", icon: ChatIcon },
  { href: "/showroom", label: "Showroom", icon: ImageIcon },
];

export function AppHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { scrollY } = useScroll();
  const { data: session, status } = useSession();
  const authenticated = status === "authenticated" && !!session?.user;
  const isSuperAdmin = session?.user?.role === "super_admin";

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 12);
  });

  const allLinks = isSuperAdmin
    ? [...NAV_LINKS, { href: "/adminkenya", label: "Control Room", icon: DashboardIcon }]
    : NAV_LINKS;

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "sticky top-0 z-50 border-b transition-colors",
        scrolled ? "border-border bg-background/90 backdrop-blur-xl" : "border-border bg-background",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="WALLORA home">
          <WalloraLogo />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {allLinks.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-secondary-text hover:text-foreground hover:bg-surface",
                )}
              >
                <Icon size={16} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          {authenticated ? (
            <UserMenu user={session!.user} />
          ) : (
            <>
              <Button variant="ghost" className="text-secondary-text hover:text-foreground" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                <Link href="/register">Create account</Link>
              </Button>
            </>
          )}
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation menu">
              <MenuIcon size={20} />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[85vw] max-w-sm border-border bg-background p-0">
            <SheetHeader className="border-b border-border px-5 py-4">
              <SheetTitle asChild><div><WalloraLogo /></div></SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-3 py-4" aria-label="Mobile">
              {allLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-3 text-sm font-medium text-secondary-text transition-colors hover:bg-surface hover:text-foreground"
                    >
                      <Icon size={18} />
                      {link.label}
                    </Link>
                  </SheetClose>
                );
              })}
            </nav>
            <div className="mt-auto flex flex-col gap-2 border-t border-border px-5 py-4">
              {authenticated ? null : (
                <>
                  <Button variant="ghost" className="justify-start text-secondary-text" asChild>
                    <SheetClose asChild><Link href="/login">Sign in</Link></SheetClose>
                  </Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                    <SheetClose asChild><Link href="/register">Create account</Link></SheetClose>
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </motion.header>
  );
}
