"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { LockKeyhole, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Shown instead of a silent redirect so a signed-in user understands why the
 * control room is unavailable and how to switch to the super-admin account.
 */
export function AdminAccessDenied({
  signedIn,
  email,
}: {
  signedIn: boolean;
  email: string | null;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10">
          {signedIn ? (
            <LockKeyhole className="size-6 text-primary" />
          ) : (
            <Sparkles className="size-6 text-primary" />
          )}
        </div>
        <h1 className="mt-4 font-display text-xl font-bold">
          {signedIn ? "Control Room access required" : "Sign in to continue"}
        </h1>
        <p className="mt-2 text-sm text-secondary-text">
          {signedIn ? (
            <>
              <span className="break-all">{email}</span> is signed in, but this area is
              restricted to the <strong className="text-foreground">super_admin</strong>{" "}
              account. Sign out and sign in with the platform administrator account.
            </>
          ) : (
            <>You are not signed in. Sign in with the platform administrator account.</>
          )}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {signedIn && (
            <Button onClick={() => signOut({ callbackUrl: "/adminkenya" })}>
              Sign out & switch account
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/">Back to WALLORA</Link>
          </Button>
        </div>
        <p className="mt-6 text-[11px] uppercase tracking-[0.2em] text-secondary-text">
          WALLORA · Restricted area
        </p>
      </div>
    </div>
  );
}
