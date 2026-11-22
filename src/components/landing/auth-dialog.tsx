"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Loader2, Sparkles, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAuthDialog } from "@/stores/auth-dialog";

type Status = "idle" | "loading" | "success" | "error";

const SIGNIN_FIELDS = ["email", "password"] as const;
const REGISTER_FIELDS = ["displayName", "username", "email", "password", "acceptTerms"] as const;

export function AuthDialog() {
  const { open, view, switchView, setOpen } = useAuthDialog();
  const isRegister = view === "register";

  const [showPassword, setShowPassword] = React.useState(false);
  const [forgotPassword, setForgotPassword] = React.useState(false);
  const [status, setStatus] = React.useState<Status>("idle");
  const [error, setError] = React.useState<string>("");
  const [fields, setFields] = React.useState<Record<string, string | boolean>>({});

  const setField = (key: string, value: string | boolean) => {
    setFields((f) => ({ ...f, [key]: value }));
    if (status === "error") {
      setStatus("idle");
      setError("");
    }
  };

  // Reset form state whenever the dialog opens or switches view.
  React.useEffect(() => {
    if (open) {
      setStatus("idle");
      setError("");
      setShowPassword(false);
      setForgotPassword(false);
    }
  }, [open, view]);

  const handleClose = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setTimeout(() => {
        setStatus("idle");
        setError("");
        setFields({});
      }, 250);
    }
  };

  const validateRegister = (): string | null => {
    const displayName = String(fields.displayName ?? "").trim();
    const username = String(fields.username ?? "").trim().toLowerCase();
    const email = String(fields.email ?? "").trim().toLowerCase();
    const password = String(fields.password ?? "");
    const acceptTerms = Boolean(fields.acceptTerms);

    if (displayName.length < 2) return "Display name must be at least 2 characters";
    if (displayName.length > 60) return "Display name is too long";
    if (username.length < 3) return "Username must be at least 3 characters";
    if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(username))
      return "Username must use lowercase letters, numbers and dashes";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address";
    if (password.length < 8) return "Password must be at least 8 characters";
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password))
      return "Password must include both letters and numbers";
    if (!acceptTerms) return "You must accept the Terms of Service and Privacy Policy";
    return null;
  };

  const handleRegister = async () => {
    const validationError = validateRegister();
    if (validationError) {
      setStatus("error");
      setError(validationError);
      return;
    }

    setStatus("loading");
    setError("");

    const displayName = String(fields.displayName).trim();
    const username = String(fields.username).trim().toLowerCase();
    const email = String(fields.email).trim().toLowerCase();
    const password = String(fields.password);

    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, username, email, password, acceptTerms: true }),
      });
      const body = await res.json();

      if (res.status !== 201) {
        setStatus("error");
        setError(body?.error?.message ?? "Could not create your account.");
        return;
      }

      // Auto sign-in after successful registration. The server is confirmed
      // reachable here (register just succeeded), so a fetch failure is
      // almost certainly a transient cold-compile — retry once.
      const autoSignIn = async (): Promise<"ok" | "fail"> => {
        try {
          const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
          });
          return result?.error ? "fail" : "ok";
        } catch (err) {
          if (err instanceof TypeError) {
            await new Promise((r) => setTimeout(r, 1500));
            try {
              const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
              });
              return result?.error ? "fail" : "ok";
            } catch {
              return "fail";
            }
          }
          return "fail";
        }
      };

      await autoSignIn();

      // Either way (signed in or not), the account was created successfully.
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof TypeError
          ? "Couldn't reach the server — it may be restarting. Please wait a few seconds and try again."
          : "Network error. Please check your connection and try again.",
      );
    }
  };

  const handleSignIn = async () => {
    const email = String(fields.email ?? "").trim().toLowerCase();
    const password = String(fields.password ?? "");

    if (!email || !password) {
      setStatus("error");
      setError("Enter your email and password.");
      return;
    }

    setStatus("loading");
    setError("");

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
        // is unreachable (mid-restart / cold compile). Distinguish that from a
        // real credentials error so the message is actionable.
        if (err instanceof TypeError) return "network";
        throw err;
      }
    };

    let outcome = await attempt();

    // One automatic retry — the dev server is usually back within a second.
    if (outcome === "network") {
      await new Promise((r) => setTimeout(r, 1500));
      outcome = await attempt();
    }

    if (outcome === "invalid") {
      setStatus("error");
      setError("Invalid email or password.");
      return;
    }
    if (outcome === "network") {
      setStatus("error");
      setError("Couldn't reach the server — it may be restarting. Please wait a few seconds and try again.");
      return;
    }

    setStatus("success");
  };

  const handleForgotPassword = async () => {
    const email = String(fields.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("error");
      setError("Enter your email address first.");
      return;
    }

    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/v1/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      if (!res.ok) {
        setStatus("error");
        setError(body?.error?.message ?? "Could not send a reset email.");
        return;
      }
      setStatus("success");
    } catch {
      setStatus("error");
      setError("Network error. Please check your connection and try again.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "loading" || status === "success") return;
    if (forgotPassword) handleForgotPassword();
    else if (isRegister) handleRegister();
    else handleSignIn();
  };

  const isLoading = status === "loading";
  const isSuccess = status === "success";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-border bg-background sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] text-primary">
              {forgotPassword ? "Account recovery" : isRegister ? "Create account" : "Welcome back"}
            </Badge>
          </div>
          <DialogTitle className="font-display text-xl">
            {isSuccess
              ? forgotPassword
                ? "Check your email"
                : isRegister
                  ? "Welcome to WALLORA"
                  : "Signed in"
              : forgotPassword
                ? "Reset your password"
                : isRegister
                  ? "Create your WALLORA account"
                  : "Sign in to WALLORA"}
          </DialogTitle>
          <DialogDescription className="text-secondary-text">
            {isSuccess
              ? forgotPassword
                ? "If that email belongs to an account, a reset link is on its way."
                : "Taking you to your account…"
              : forgotPassword
                ? "Enter your email and we’ll send you a secure reset link."
                : isRegister
                  ? "Join the creative ecosystem. Discovery, AI, studios and a creator marketplace."
                  : "Continue where you left off. Your session stays on this device."}
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <p className="text-sm text-foreground">
              {forgotPassword
                ? "Your reset request was submitted."
                : isRegister
                  ? "Your account is ready."
                  : "You are signed in."}
            </p>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                if (forgotPassword) {
                  setForgotPassword(false);
                  setStatus("idle");
                  setError("");
                  return;
                }
                handleClose(false);
              }}
            >
              {forgotPassword ? "Back to sign in" : "Continue"}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {isRegister && (
              <>
                <Field
                  id="displayName"
                  label="Display name"
                  placeholder="Your name"
                  value={String(fields.displayName ?? "")}
                  onChange={(v) => setField("displayName", v)}
                  autoComplete="name"
                />
                <Field
                  id="username"
                  label="Username"
                  placeholder="lowercase, numbers, dashes"
                  value={String(fields.username ?? "")}
                  onChange={(v) => setField("username", v.toLowerCase())}
                  autoComplete="username"
                  hint="Your public handle, e.g. wallora.com/you"
                />
              </>
            )}

            <Field
              id="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={String(fields.email ?? "")}
              onChange={(v) => setField("email", v)}
              autoComplete="email"
            />

            {!forgotPassword && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="password" className="text-xs font-medium text-secondary-text">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={isRegister ? "At least 8 characters, letters + numbers" : "Your password"}
                    value={String(fields.password ?? "")}
                    onChange={(e) => setField("password", e.target.value)}
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    className="border-border bg-surface pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-secondary-text transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {isRegister && (
              <label className="flex items-start gap-2.5 text-sm text-secondary-text cursor-pointer">
                <Checkbox
                  checked={Boolean(fields.acceptTerms)}
                  onCheckedChange={(v) => setField("acceptTerms", Boolean(v))}
                  className="mt-0.5"
                  aria-label="Accept Terms of Service and Privacy Policy"
                />
                <span>
                  I accept the{" "}
                  <span className="text-foreground underline-offset-2 hover:underline">Terms of Service</span>{" "}
                  and{" "}
                  <span className="text-foreground underline-offset-2 hover:underline">Privacy Policy</span>.
                </span>
              </label>
            )}

            {status === "error" && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {forgotPassword ? "Sending reset link…" : isRegister ? "Creating account…" : "Signing in…"}
                </>
              ) : forgotPassword ? (
                "Send reset link"
              ) : isRegister ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </Button>

            <div className="flex items-center justify-between gap-3 text-xs text-secondary-text">
              {forgotPassword ? (
                <button
                  type="button"
                  onClick={() => {
                    setForgotPassword(false);
                    setStatus("idle");
                    setError("");
                  }}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Back to sign in
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPassword(false);
                      switchView(isRegister ? "signin" : "register");
                    }}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {isRegister ? "Already have an account? Sign in" : "New to WALLORA? Create an account"}
                  </button>
                  {!isRegister && (
                    <button
                      type="button"
                      onClick={() => {
                        setForgotPassword(true);
                        setStatus("idle");
                        setError("");
                      }}
                      className="font-medium text-secondary-text underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </>
              )}
            </div>
          </form>
        )}

        {!isSuccess && (
          <p className="mt-1 flex items-center justify-center gap-1 text-center text-[11px] text-secondary-text">
            By continuing you agree to WALLORA&apos;s Terms and Privacy Policy.
            <ArrowRight className="h-3 w-3" />
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-xs font-medium text-secondary-text">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="border-border bg-surface"
      />
      {hint && <p className="text-[11px] text-secondary-text/80">{hint}</p>}
    </div>
  );
}
