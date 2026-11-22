/**
 * WALLORA mobile design system — premium dark, image-first.
 * Single source of truth for colors, tiers, spacing and typography.
 */

export const C = {
  bg: "#0B0C0F",
  bgDeep: "#07080A",
  bgElevated: "#0F1116",
  card: "#14161B",
  raised: "#1C1F26",
  raisedHover: "#242832",
  text: "#F7F7F5",
  textSoft: "#C9CCD3",
  muted: "#9296A1",
  mutedDark: "#646874",
  accent: "#D7B879",
  accentBright: "#F0D9A8",
  accentDim: "rgba(215,184,121,0.14)",
  border: "#292C33",
  borderSoft: "#1F222A",
  success: "#43B581",
  successDim: "rgba(67,181,129,0.14)",
  error: "#E46F75",
  errorDim: "rgba(228,111,117,0.14)",
  blue: "#5B9EEA",
  blueDim: "rgba(91,158,234,0.14)",
  gold: "#D7B879",
  goldDim: "rgba(215,184,121,0.14)",
  supreme: "#B98CFF",
  supremeDim: "rgba(185,140,255,0.14)",
  white: "#FFFFFF",
  black: "#000000",
  overlay: "rgba(0,0,0,0.72)",
  overlayLight: "rgba(0,0,0,0.42)",
} as const;

export type VerificationTier = "free" | "verified" | "premium" | "supreme";

export const TIER_META: Record<
  VerificationTier,
  { label: string; short: string; color: string; dim: string; rank: number }
> = {
  free: {
    label: "Free verified",
    short: "FREE",
    color: C.muted,
    dim: "rgba(146,150,161,0.14)",
    rank: 0,
  },
  verified: {
    label: "Verified creator",
    short: "VERIFIED",
    color: C.blue,
    dim: C.blueDim,
    rank: 1,
  },
  premium: {
    label: "Premium creator",
    short: "PREMIUM",
    color: C.gold,
    dim: C.goldDim,
    rank: 2,
  },
  supreme: {
    label: "Supreme creator",
    short: "SUPREME",
    color: C.supreme,
    dim: C.supremeDim,
    rank: 3,
  },
};

export function tierMeta(tier?: string | null) {
  return TIER_META[(tier as VerificationTier) ?? "free"] ?? TIER_META.free;
}

export const S = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const R = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/** Shared shadow presets */
export const SHADOW = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  hero: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  glowGold: {
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;
