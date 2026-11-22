import { BadgeCheck, Crown, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import type { VerificationTier } from "@/lib/verification/tiers";

/**
 * WALLORA verification marks — always real SVG icons, never emoji or text.
 *   free     → grey tick (baseline authenticity, every account)
 *   verified → blue tick (admin approved)
 *   premium  → gold crown (admin approved)
 *   supreme  → violet spark (admin approved, highest limits)
 */
export function VerifiedTick({
  tier = "free",
  premium,
  className,
}: {
  tier?: VerificationTier;
  /** @deprecated pass `tier` instead; kept for existing callers. */
  premium?: boolean;
  className?: string;
}) {
  const resolved: VerificationTier = premium ? "premium" : tier;

  if (resolved === "supreme") {
    return (
      <span
        className={cn("inline-flex items-center text-[#B98CFF]", className)}
        title="WALLORA Supreme creator"
        aria-label="WALLORA Supreme creator"
      >
        <Sparkles className="size-3.5" strokeWidth={2.5} />
      </span>
    );
  }

  if (resolved === "premium") {
    return (
      <span
        className={cn("inline-flex items-center text-[#D7B879]", className)}
        title="WALLORA Premium verified"
        aria-label="WALLORA Premium verified"
      >
        <Crown className="size-3.5" strokeWidth={2.5} />
      </span>
    );
  }

  if (resolved === "verified") {
    return (
      <BadgeCheck
        className={cn("size-3.5 text-[#3B9EFF]", className)}
        fill="currentColor"
        stroke="white"
        strokeWidth={1.5}
        aria-label="Verified creator"
      />
    );
  }

  return (
    <BadgeCheck
      className={cn("size-3.5 text-[#9CA3AF]", className)}
      fill="currentColor"
      stroke="white"
      strokeWidth={1.5}
      aria-label="Free verified member"
    />
  );
}
