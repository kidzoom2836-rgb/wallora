"use client";

import * as React from "react";
import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WalloraLogo } from "@/components/brand/wallora-logo";
import {
  EyeIcon,
  EyeOffIcon,
  LoaderIcon,
  ArrowRightIcon,
} from "@/components/icons/wallora-icons";

/**
 * Inner login form. Uses useSearchParams() to read an optional callbackUrl,
 * so it MUST be wrapped in a <Suspense> boundary for Next.js static
 * prerendering (see LoginPage below). Otherwise the production build fails
 * with "useSearchParams() should be wrapped in a suspense boundary".
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/discover";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);

    const attempt = async (): Promise<"ok" | "invalid" | "network"> => {
      try {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });
        if (result?.error) return "invalid";
        return "ok";
      } catch (err) {
        // signIn() throws a TypeError ("Failed to fetch") when the dev server
        // is unreachable — e.g. mid-restart or still compiling a route. Treat
        // that as a transient network error rather than a credentials problem.
        if (err instanceof TypeError) return "network";
        throw err;
      }
    };

    let outcome = await attempt();

    // One automatic retry after a short delay — the dev server is often back
    // within a second or two of a cold compile / keepalive restart.
    if (outcome === "network") {
      await new Promise((r) => setTimeout(r, 1500));
      outcome = await attempt();
    }

    if (outcome === "invalid") {
      toast.error("Invalid email or password");
      setLoading(false);
      return;
    }
    if (outcome === "network") {
      toast.error(
        "Couldn't reach the server — it may be restarting. Please wait a few seconds and try again.",
      );
      setLoading(false);
      return;
    }
    toast.success("Signed in");
    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-xs font-medium text-secondary-text">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="border-border bg-surface"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password" className="text-xs font-medium text-secondary-text">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
            className="border-border bg-surface pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-secondary-text hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        className="bg-primary text-primary-foreground hover:bg-primary/90"
        disabled={loading}
      >
        {loading ? (
          <><LoaderIcon size={16} style={{ animation: "spin 1s linear infinite" }} /> Signing in…</>
        ) : (
          <>Sign in <ArrowRightIcon size={16} /></>
        )}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4">
          <Link href="/" aria-label="WALLORA home">
            <WalloraLogo />
          </Link>
          <h1 className="font-display text-2xl font-semibold text-foreground">Welcome back</h1>
          <p className="text-sm text-secondary-text">Sign in to your WALLORA account</p>
        </div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-sm text-secondary-text">
          New to WALLORA?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
