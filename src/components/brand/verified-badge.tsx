import { BadgeCheck, Crown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * WALLORA verification marks. Verified is a blue badge; Premium is gold.
 * Both are real SVG icons — never a plain text checkmark.
 */
export function VerifiedTick({
  premium = false,
  className,
}: {
  premium?: boolean;
  className?: string;
}) {
  if (premium) {
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
