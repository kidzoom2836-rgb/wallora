"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { UploadCloud } from "lucide-react";

import { MyUploads } from "@/components/landing/my-uploads";
import { WallpaperDetailDialog } from "@/components/landing/wallpaper-detail-dialog";
import { Button } from "@/components/ui/button";
import { useAuthDialog } from "@/stores/auth-dialog";

export default function UploadsPage() {
  const { status } = useSession();
  const openSignIn = useAuthDialog((s) => s.openSignIn);

  return (
    <div className="bg-background py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Creator Studio</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground">My uploads</h1>
          <p className="mt-2 text-sm text-secondary-text">
            Track moderation status and manage every wallpaper you have published.
          </p>
        </header>

        {status === "unauthenticated" && (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface/40 p-12 text-center">
            <UploadCloud className="mx-auto size-8 text-primary" />
            <p className="mt-4 text-sm font-medium text-foreground">Sign in to manage your uploads</p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <Button className="bg-primary text-primary-foreground" onClick={() => openSignIn()}>
                Sign in
              </Button>
              <Button asChild variant="ghost">
                <Link href="/discover">Browse wallpapers</Link>
              </Button>
            </div>
          </div>
        )}
      </div>

      <MyUploads />
      <WallpaperDetailDialog />
    </div>
  );
}
