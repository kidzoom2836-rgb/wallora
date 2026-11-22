"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Crown,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { VerifiedTick } from "@/components/brand/verified-badge";
import type { VerificationTier } from "@/lib/verification/tiers";
import { cn } from "@/lib/utils";

type GateState = {
  tier: VerificationTier;
  claimed: boolean;
};

type GuardOptions = {
  /** Short label shown in the popup, e.g. "upload a wallpaper". */
  action?: string;
  /** Minimum tier required. Defaults to free (every account). */
  minimum?: VerificationTier;
};

type VerificationContextValue = {
  tier: VerificationTier;
  claimed: boolean;
  ready: boolean;
  /** Wrap a protected action. Shows the explainer once, then runs `fn`. */
  guard: <T>(fn: () => T | Promise<T>, options?: GuardOptions) => void;
  /** Show the explainer without running an action (from the user menu). */
  explain: () => void;
};

const VerificationContext = React.createContext<VerificationContextValue | null>(null);

/** Fetch verification state for the signed-in user. */
function useVerificationState() {
  const { status } = useSession();
  return useQuery<{ data: GateState }>({
    queryKey: ["verification-state"],
    queryFn: () => fetch("/api/v1/verification/state", { cache: "no-store" }).then((r) => r.json()),
    enabled: status === "authenticated",
    staleTime: 60 * 1000,
  });
}

export function VerificationProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const { status } = useSession();
  const stateQuery = useVerificationState();
  const [explainer, setExplainer] = React.useState<{ action: string; minimum: VerificationTier } | null>(
    null,
  );
  const pendingAction = React.useRef<(() => void) | null>(null);

  const tier = stateQuery.data?.data.tier ?? "free";
  const claimed = stateQuery.data?.data.claimed ?? false;

  const claim = useMutation({
    mutationFn: () =>
      fetch("/api/v1/verification/claim", { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      qc.setQueryData<{ data: GateState }>(["verification-state"], (old) => ({
        data: { tier, claimed: true },
      }));
      setExplainer(null);
      const fn = pendingAction.current;
      pendingAction.current = null;
      fn?.();
    },
  });

  const guard = React.useCallback(
    <T,>(fn: () => T | Promise<T>, options?: GuardOptions) => {
      if (status !== "authenticated") {
        setExplainer({ action: options?.action ?? "continue", minimum: "free" });
        return;
      }
      if (!stateQuery.isFetched || !claimed) {
        pendingAction.current = () => {
          void fn();
        };
        setExplainer({ action: options?.action ?? "continue", minimum: options?.minimum ?? "free" });
        return;
      }
      fn();
    },
    [status, stateQuery.isFetched, claimed],
  );

  const explain = React.useCallback(() => {
    setExplainer({ action: "use WALLORA", minimum: "free" });
  }, []);

  return (
    <VerificationContext.Provider value={{ tier, claimed, ready: stateQuery.isFetched, guard, explain }}>
      {children}
      <VerificationExplainer
        open={!!explainer}
        action={explainer?.action ?? "continue"}
        signedIn={status === "authenticated"}
        claiming={claim.isPending}
        onClose={() => {
          setExplainer(null);
          pendingAction.current = null;
        }}
        onContinue={() => claim.mutate()}
      />
    </VerificationContext.Provider>
  );
}

/** Use this in any client component to wrap a protected action. */
export function useVerificationGate() {
  const ctx = React.useContext(VerificationContext);
  if (!ctx) throw new Error("useVerificationGate must be used inside VerificationProvider");
  return ctx;
}

function VerificationExplainer({
  open,
  action,
  signedIn,
  claiming,
  onClose,
  onContinue,
}: {
  open: boolean;
  action: string;
  signedIn: boolean;
  claiming: boolean;
  onClose: () => void;
  onContinue: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="verification-explainer-title"
            className="w-full max-w-md overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl sm:rounded-2xl"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
          >
            <div className="relative border-b border-border px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 text-secondary-text hover:text-foreground"
              >
                <X className="size-4" />
              </button>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="size-5" />
                </span>
                <div>
                  <h2 id="verification-explainer-title" className="font-display text-base font-semibold">
                    Verification keeps WALLORA real
                  </h2>
                  <p className="text-xs text-secondary-text">One quick step before you {action}.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-5 py-5">
              <p className="text-sm leading-relaxed text-secondary-text">
                Verification helps the authenticity of our program. It tells the community that
                people, posts and creators on WALLORA are who they say they are — and it keeps our
                creative space safe to explore.
              </p>

              <div className="space-y-2">
                <TierRow
                  tick={<VerifiedTick tier="free" className="size-4" />}
                  name="Free verified"
                  detail="Automatic for every member. Your grey tick."
                />
                <TierRow
                  tick={<VerifiedTick tier="verified" className="size-4" />}
                  name="Verified creator"
                  detail="Apply with your work — reviewed by our team."
                />
                <TierRow
                  tick={<VerifiedTick tier="premium" className="size-4" />}
                  name="Premium verified"
                  detail="Gold tick with priority placement and Pro perks."
                />
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-secondary-text">
                <span className="mr-1.5 inline-flex align-middle text-primary">
                  <Sparkles className="size-3.5" />
                </span>
                Your free grey tick is applied instantly. Email verification will be added later —
                nothing to do now.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border bg-raised/40 px-5 py-4">
              {signedIn ? (
                <>
                  <Button className="flex-1" onClick={onContinue} disabled={claiming}>
                    {claiming ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
                    Verify free &amp; continue
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link href="/verification" onClick={onClose}>Learn more</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button className="flex-1" asChild>
                    <Link href="/login">Sign in to verify</Link>
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link href="/register">Create account</Link>
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TierRow({
  tick,
  name,
  detail,
}: {
  tick: React.ReactNode;
  name: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-raised/40 px-3 py-2">
      <span className="mt-0.5 shrink-0">{tick}</span>
      <div>
        <p className="text-xs font-semibold">{name}</p>
        <p className="text-[11px] leading-relaxed text-secondary-text">{detail}</p>
      </div>
    </div>
  );
}

// Re-export icons used by consumers that want a quick gate hint.
export const GateIcons = { UploadCloud, MessageCircle, Crown };
