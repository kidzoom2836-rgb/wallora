"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { WalloraLogo } from "@/components/brand/wallora-logo";
import {
  EyeIcon,
  EyeOffIcon,
  LoaderIcon,
  ArrowRightIcon,
} from "@/components/icons/wallora-icons";

export default function RegisterPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [acceptTerms, setAcceptTerms] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (displayName.length < 2) { setError("Display name must be at least 2 characters"); return; }
    if (username.length < 3) { setError("Username must be at least 3 characters"); return; }
    if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(username.toLowerCase())) {
      setError("Username must use lowercase letters, numbers and dashes"); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email address"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must include both letters and numbers"); return;
    }
    if (!acceptTerms) { setError("You must accept the Terms of Service and Privacy Policy"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, username: username.toLowerCase(), email: email.toLowerCase(), password, acceptTerms: true }),
      });
      const body = await res.json();
      if (res.status !== 201) {
        setError(body?.error?.message ?? "Could not create your account");
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        toast.success("Account created", { description: "Please sign in to continue." });
        router.push("/login");
        return;
      }
      toast.success("Welcome to WALLORA");
      router.push("/discover");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4">
          <Link href="/" aria-label="WALLORA home">
            <WalloraLogo />
          </Link>
          <h1 className="font-display text-2xl font-semibold text-foreground">Create your account</h1>
          <p className="text-sm text-secondary-text">Join the WALLORA creative ecosystem</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="displayName" className="text-xs font-medium text-secondary-text">Display name</Label>
            <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="border-border bg-surface" required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="username" className="text-xs font-medium text-secondary-text">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="lowercase, numbers, dashes" className="border-border bg-surface" required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-xs font-medium text-secondary-text">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="border-border bg-surface" required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="text-xs font-medium text-secondary-text">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters, letters + numbers"
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

          <label className="flex items-start gap-2.5 text-sm text-secondary-text cursor-pointer">
            <Checkbox checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(Boolean(v))} className="mt-0.5" />
            <span>
              I accept the{" "}
              <span className="text-foreground underline-offset-2 hover:underline">Terms of Service</span>
              {" "}and{" "}
              <span className="text-foreground underline-offset-2 hover:underline">Privacy Policy</span>.
            </span>
          </label>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading}>
            {loading ? (
              <><LoaderIcon size={16} className="animate-spin" /> Creating account…</>
            ) : (
              <>Create account <ArrowRightIcon size={16} /></>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-secondary-text">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
