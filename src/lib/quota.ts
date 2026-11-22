import { db } from "@/lib/db";
import { getTier, TIER_LIMITS, type VerificationTier } from "@/lib/verification/store";

/**
 * WALLORA quota system.
 *
 * Tracks AI usage in the UsageLedger and enforces a daily limit per user.
 * The limit is admin-configurable in production — here it's a constant
 * that can be moved to app settings later.
 */

export const FREE_DAILY_MESSAGE_LIMIT = 20;
export const PLUS_DAILY_MESSAGE_LIMIT = 100;

const ACTION_CREDITS: Record<string, number> = {
  ai_message: 1,
  ai_enhance: 1,
  ai_generate: 5,
  ai_analyze: 2,
};

/** Returns the daily credit limit for a role + verification tier. */
export function getDailyLimit(role: string, tier: VerificationTier = "free"): number {
  if (role === "admin" || role === "super_admin") return Infinity;
  // Privileged roles keep their legacy floor; verification can only raise it.
  const roleFloor =
    role === "creator" || role === "moderator" ? PLUS_DAILY_MESSAGE_LIMIT : FREE_DAILY_MESSAGE_LIMIT;
  return Math.max(roleFloor, TIER_LIMITS[tier].dailyCredits);
}

/** Resolves the effective daily limit for a user. */
export async function getDailyLimitForUser(userId: string, role: string): Promise<number> {
  return getDailyLimit(role, await getTier(userId));
}

/** Count today's usage for a user. */
export async function getTodayUsage(userId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const entries = await db.usageLedger.aggregate({
    where: {
      userId,
      createdAt: { gte: startOfDay },
    },
    _sum: { creditsUsed: true },
  });

  return entries._sum.creditsUsed ?? 0;
}

/**
 * Check if the user has remaining quota. Returns ok or an error response
 * suitable for returning from a route handler.
 */
export async function checkQuota(userId: string, role: string, action: string = "ai_message") {
  const limit = await getDailyLimitForUser(userId, role);
  if (limit === Infinity) return { ok: true as const, remaining: Infinity, limit };

  const used = await getTodayUsage(userId);
  const cost = ACTION_CREDITS[action] ?? 1;
  const remaining = limit - used;

  if (remaining < cost) {
    return {
      ok: false as const,
      remaining: Math.max(0, remaining),
      limit,
      needed: cost,
    };
  }

  return { ok: true as const, remaining, limit };
}

/** Record a usage entry (append-only). */
export async function recordUsage(params: {
  userId: string;
  action: string;
  creditsUsed?: number;
  conversationId?: string;
  messageId?: string;
}) {
  const credits = params.creditsUsed ?? ACTION_CREDITS[params.action] ?? 1;
  return db.usageLedger.create({
    data: {
      userId: params.userId,
      action: params.action,
      creditsUsed: credits,
      conversationId: params.conversationId,
      messageId: params.messageId,
    },
  });
}
