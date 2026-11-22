"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { BadgeCheck, Check, Crown, Loader2, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { VerifiedTick } from "@/components/brand/verified-badge";
import { cn } from "@/lib/utils";

type Tier = "free" | "verified" | "premium";
type Request = {
  id: string;
  tier: Exclude<Tier, "free">;
  status: "pending" | "approved" | "rejected";
  reason: string;
  portfolio: string;
  note: string | null;
  createdAt: string;
};

export default function VerificationPage() {
  const qc = useQueryClient();
  const [tier, setTier] = React.useState<Exclude<Tier, "free">>("verified");
  const [reason, setReason] = React.useState("");
  const [portfolio, setPortfolio] = React.useState("");

  const query = useQuery<{ data: { request: Request | null; tier: Tier; claimed: boolean } }>({
    queryKey: ["verification-me"],
    queryFn: () => fetch("/api/v1/verification").then((r) => r.json()),
  });

  const apply = useMutation({
    mutationFn: (body: { tier: string; reason: string; portfolio: string }) =>
      fetch("/api/v1/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? "Could not submit.");
        return json;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["verification-me"] });
      qc.invalidateQueries({ queryKey: ["verification-state"] });
      toast.success("Application submitted for review");
    },
    onError: (e: Error) => toast.error("Could not submit", { description: e.message }),
  });

  const current = query.data?.data.request;
  const currentTier = query.data?.data.tier ?? "free";

  const tierMeta: Record<Tier, { name: string; detail: string }> = {
    free: { name: "Free verified", detail: "Your grey tick — active on every account." },
    verified: { name: "Verified creator", detail: "Blue tick, reviewed by our team." },
    premium: { name: "Premium verified", detail: "Gold tick with Pro perks." },
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <BadgeCheck className="size-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold">Verification on WALLORA</h1>
          <p className="mt-1 text-sm text-secondary-text">
            Verification helps the authenticity of our program — for creators and the community.
          </p>
        </div>
      </div>

      {/* Baseline tier — always active */}
      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <VerifiedTick tier="free" className="size-6" />
            <div>
              <p className="text-sm font-semibold">Free verified — active</p>
              <p className="text-xs text-secondary-text">
                Your grey tick is applied automatically. It lets you post, follow creators, chat with
                AI and build projects.
              </p>
            </div>
          </div>
          <Badge variant="secondary">Baseline</Badge>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-secondary-text">
          We&apos;ll add email verification later — there&apos;s nothing you need to do now to keep
          your free tick.
        </p>
      </div>

      {currentTier !== "free" && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <VerifiedTick tier={currentTier} className="size-5" />
          <div>
            <p className="text-sm font-semibold">{tierMeta[currentTier].name} active</p>
            <p className="text-xs text-secondary-text">Your badge is shown across WALLORA.</p>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold">Upgrade your badge</h2>
        <p className="mt-1 text-xs text-secondary-text">
          Apply with real work — a profile, portfolio, store or published site. Reviewed by our team.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TierCard
            active={tier === "verified"}
            icon={<VerifiedTick tier="verified" className="size-5" />}
            title="Verified creator"
            subtitle="Blue tick on your work"
            points={["Blue badge on wallpapers and comments", "Appears on your public profile", "Priority marketplace review"]}
            onClick={() => setTier("verified")}
          />
          <TierCard
            active={tier === "premium"}
            icon={<VerifiedTick tier="premium" className="size-5" />}
            title="Premium verified"
            subtitle="Gold badge + Pro perks"
            points={["Gold badge with priority placement", "Direct external links for built sites", "Founding-creator storefront treatment"]}
            onClick={() => setTier("premium")}
          />
        </div>
      </div>

      {current?.status === "pending" && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <Loader2 className="size-5 animate-spin text-amber-500" />
          <div>
            <p className="text-sm font-semibold">Application under review</p>
            <p className="text-xs text-secondary-text">
              Submitted {new Date(current.createdAt).toLocaleDateString()} · We&apos;ll update this page once decided.
            </p>
          </div>
        </div>
      )}

      {current && current.status !== "pending" && (
        <div className={cn(
          "mt-6 rounded-xl border p-4",
          current.status === "approved"
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-destructive/30 bg-destructive/5",
        )}>
          <p className="flex items-center gap-2 text-sm font-semibold">
            {current.status === "approved" ? <Check className="size-4 text-emerald-500" /> : <ShieldCheck className="size-4 text-destructive" />}
            Application {current.status}
          </p>
          {current.note && <p className="mt-1 text-xs text-secondary-text">{current.note}</p>}
        </div>
      )}

      <form
        className="mt-8 space-y-4 rounded-2xl border border-border bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          apply.mutate({ tier, reason, portfolio });
        }}
      >
        <div>
          <h2 className="font-display text-lg font-semibold">Apply for {tier === "premium" ? "Premium" : "Verified"}</h2>
          <p className="mt-1 text-xs text-secondary-text">
            Tell us what you create and link real work. Applications are reviewed manually.
          </p>
        </div>
        <div>
          <label className="text-xs text-secondary-text">Why should you be verified?</label>
          <Textarea
            required
            minLength={20}
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tell us what you create, how long you've been doing it, and why the badge matters to your audience…"
            className="mt-1.5"
          />
        </div>
        <div>
          <label className="text-xs text-secondary-text">Portfolio or profile link</label>
          <Input
            required
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
            placeholder="https://… or @username on WALLORA"
            className="mt-1.5"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={apply.isPending}>
            {apply.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Submit application
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link href="/builder">Build a site to show instead</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

function TierCard({
  active,
  icon,
  title,
  subtitle,
  points,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  points: string[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left transition-colors",
        active ? "border-primary bg-primary/5" : "border-border bg-surface hover:border-primary/40",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-semibold">{icon}{title}</span>
        <Badge variant={active ? "default" : "secondary"}>{active ? "Selected" : "Select"}</Badge>
      </div>
      <p className="mt-1 text-xs text-secondary-text">{subtitle}</p>
      <ul className="mt-3 space-y-1.5">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-xs text-secondary-text">
            <Check className="mt-0.5 size-3 shrink-0 text-primary" /> {p}
          </li>
        ))}
      </ul>
    </button>
  );
}
