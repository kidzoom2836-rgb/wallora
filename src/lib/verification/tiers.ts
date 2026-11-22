/**
 * Client-safe verification tier definitions.
 *
 * This module intentionally has no server imports so it can be used by both
 * API routes and React client components.
 */
export type VerificationTier = "free" | "verified" | "premium" | "supreme";
export type VerificationStatus = "pending" | "approved" | "rejected";

export const TIER_RANK: Record<VerificationTier, number> = {
  free: 0,
  verified: 1,
  premium: 2,
  supreme: 3,
};

/** Practical per-tier limits. Enforced by their respective API routes. */
export const TIER_LIMITS: Record<
  VerificationTier,
  { dailyCredits: number; postsPerDay: number; uploadsPerDay: number; projects: number }
> = {
  free: { dailyCredits: 20, postsPerDay: 10, uploadsPerDay: 3, projects: 10 },
  verified: { dailyCredits: 60, postsPerDay: 30, uploadsPerDay: 10, projects: 30 },
  premium: { dailyCredits: 150, postsPerDay: 100, uploadsPerDay: 30, projects: 100 },
  supreme: { dailyCredits: 400, postsPerDay: 500, uploadsPerDay: 100, projects: 500 },
};

/** Human-readable perks shown on /verification and in account settings. */
export const TIER_PERKS: Record<VerificationTier, string[]> = {
  free: ["Grey authenticity tick", "Post, follow, chat and build projects"],
  verified: ["Blue verified tick", "3× daily AI credits", "Higher daily post limit"],
  premium: ["Gold premium badge", "7× daily AI credits", "Higher daily post limit"],
  supreme: ["Supreme badge", "20× daily AI credits", "Highest daily post limit"],
};
