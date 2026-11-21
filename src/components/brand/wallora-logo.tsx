import { cn } from "@/lib/utils";

type MonogramProps = {
  className?: string;
  /** Show the small spark dot above the W */
  spark?: boolean;
};

/**
 * WALLORA monogram — a rounded dark tile with a gold geometric "W"
 * and an optional spark dot. Pure SVG, scales to any size.
 */
export function WalloraMonogram({ className, spark = true }: MonogramProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="WALLORA monogram"
      className={cn("block", className)}
    >
      <defs>
        <linearGradient id="walloraGold" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F0D9A8" />
          <stop offset="0.5" stopColor="#D7B879" />
          <stop offset="1" stopColor="#B8964F" />
        </linearGradient>
      </defs>
      <rect
        x="1"
        y="1"
        width="46"
        height="46"
        rx="13"
        fill="#0B0C0F"
        stroke="#292C33"
        strokeWidth="1"
      />
      <path
        d="M11 16 L18 33 L24 21 L30 33 L37 16"
        fill="none"
        stroke="url(#walloraGold)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {spark && <circle cx="24" cy="11" r="1.6" fill="#D7B879" />}
    </svg>
  );
}

type WordmarkProps = {
  className?: string;
  /** Apply the gold gradient to the wordmark text */
  gradient?: boolean;
};

/**
 * WALLORA wordmark — tracked-out uppercase letters in the display font.
 */
export function WalloraWordmark({ className, gradient = false }: WordmarkProps) {
  return (
    <span
      className={cn(
        "font-display font-semibold uppercase tracking-[0.22em] select-none",
        gradient ? "gold-gradient-text" : "text-foreground",
        className,
      )}
      aria-label="WALLORA"
    >
      WALLORA
    </span>
  );
}

type LogoProps = {
  className?: string;
  monogramClassName?: string;
  wordmarkClassName?: string;
  gradient?: boolean;
  spark?: boolean;
};

/**
 * Full WALLORA lockup — monogram + wordmark, horizontally aligned.
 */
export function WalloraLogo({
  className,
  monogramClassName,
  wordmarkClassName,
  gradient = false,
  spark = true,
}: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <WalloraMonogram className={cn("h-7 w-7 shrink-0", monogramClassName)} spark={spark} />
      <WalloraWordmark
        className={cn("text-sm sm:text-base", wordmarkClassName)}
        gradient={gradient}
      />
    </span>
  );
}
