import { BadgeCheck, Crown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { VerificationTier } from "@/lib/verification/store";

/**
 * WALLORA verification marks — always real SVG icons, never emoji or text.
 *   free     → grey tick (baseline authenticity, every account)
 *   verified → blue tick (admin approved)
 *   premium  → gold crown (admin approved)
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
