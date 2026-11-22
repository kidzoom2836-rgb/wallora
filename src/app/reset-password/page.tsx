"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const [token, setToken] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      setStatus("error");
      setError("This reset link is missing its token. Open the full link from your email.");
      return;
    }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setStatus("error");
      setError("Password must be at least 8 characters and include letters and numbers.");
      return;
    }
    if (password !== confirm) {
      setStatus("error");
      setError("Passwords do not match.");
      return;
    }

    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/v1/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json();
      if (!res.ok) {
        setStatus("error");
        setError(body?.error?.message ?? "Could not reset your password.");
        return;
      }
      setStatus("success");
    } catch {
      setStatus("error");
      setError("Network error. Please check your connection and try again.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Account recovery
          </span>
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold text-foreground">Choose a new password</h1>
        <p className="mt-2 text-sm text-secondary-text">
          Reset links expire after 60 minutes and work only once.
        </p>

        {status === "success" ? (
          <div className="mt-8 flex flex-col items-center gap-4 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="size-7" />
            </span>
            <p className="text-sm text-foreground">Your password has been updated.</p>
            <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password" className="text-xs font-medium text-secondary-text">
                New password
              </Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters, letters + numbers"
                className="border-border bg-background"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-password" className="text-xs font-medium text-secondary-text">
                Confirm password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat your new password"
                className="border-border bg-background"
              />
            </div>

            {status === "error" && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={status === "loading"}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Updating password…
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 size-4" />
                  Update password
                </>
              )}
            </Button>
            <Link
              href="/login"
              className="text-center text-xs text-secondary-text underline-offset-4 hover:underline"
            >
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
