import { db } from "@/lib/db";

/**
 * WALLORA verification.
 *
 * Tiers (lowest first):
 *   free     — grey tick, granted to every account automatically. Baseline
 *              authenticity marker; required before posting/following/chatting.
 *   verified — blue tick, applied for and approved by an admin.
 *   premium  — gold tick, applied for and approved by an admin.
 *
 * Stored in StoredBlob so no Prisma migration is needed. `profile.verified`
 * remains the blue-tick source of truth; only verified/premium paint it.
 */

export type VerificationTier = "free" | "verified" | "premium";
export type VerificationStatus = "pending" | "approved" | "rejected";

export const TIER_RANK: Record<VerificationTier, number> = {
  free: 0,
  verified: 1,
  premium: 2,
};

export type VerificationRequest = {
  id: string;
  userId: string;
  tier: VerificationTier;
  reason: string;
  portfolio: string;
  status: VerificationStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  note: string | null;
  email: string | null;
  username: string | null;
  displayName: string | null;
};

const REQUESTS_KEY = "system:verification-requests";
const TIERS_KEY = "system:verification-tiers";
const CLAIMED_KEY = "system:verification-claimed";

function write(key: string, value: unknown) {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  return db.storedBlob.upsert({
    where: { key },
    update: { data: body, contentType: "application/json", size: body.length },
    create: { key, data: body, contentType: "application/json", size: body.length },
  });
}

async function read<T>(key: string, fallback: T): Promise<T> {
  const blob = await db.storedBlob.findUnique({ where: { key } });
  if (!blob) return fallback;
  try {
    return JSON.parse(Buffer.from(blob.data).toString("utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function getRequests(): Promise<VerificationRequest[]> {
  return read<VerificationRequest[]>(REQUESTS_KEY, []);
}

export async function getMyRequest(userId: string): Promise<VerificationRequest | null> {
  return (await getRequests()).find((r) => r.userId === userId) ?? null;
}

export async function createRequest(input: {
  userId: string;
  tier: VerificationTier;
  reason: string;
  portfolio: string;
  email: string | null;
  username: string | null;
  displayName: string | null;
}): Promise<VerificationRequest> {
  const requests = await getRequests();
  const existing = requests.find((r) => r.userId === input.userId);
  if (existing && existing.status === "pending") {
    throw new Error("You already have a pending verification request.");
  }
  const request: VerificationRequest = {
    id: `vr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    ...input,
    status: "pending",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    note: null,
  };
  const next = [request, ...requests.filter((r) => r.userId !== input.userId)];
  await write(REQUESTS_KEY, next);
  return request;
}

export async function reviewRequest(
  id: string,
  decision: "approved" | "rejected",
  reviewerId: string,
  note: string | null,
): Promise<VerificationRequest | null> {
  const requests = await getRequests();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const updated: VerificationRequest = {
    ...requests[idx],
    status: decision,
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewerId,
    note,
  };
  requests[idx] = updated;
  await write(REQUESTS_KEY, requests);

  if (decision === "approved") {
    // Only blue/gold paint profile.verified. Free never gets the blue tick.
    const paintsBlue = updated.tier === "verified" || updated.tier === "premium";
    if (paintsBlue) {
      await db.profile
        .update({ where: { userId: updated.userId }, data: { verified: true } })
        .catch(() => {});
    }
    await setTier(updated.userId, updated.tier);
  }
  return updated;
}

/** The tier stored for a user, or "free" as the universal baseline. */
export async function getTier(userId: string): Promise<VerificationTier> {
  const tiers = await read<Record<string, VerificationTier>>(TIERS_KEY, {});
  return tiers[userId] ?? "free";
}

/** Batch tier lookup for feed responses (one blob read, no N+1). */
export async function getTiersForUsers(
  userIds: string[],
): Promise<Record<string, VerificationTier>> {
  const tiers = await read<Record<string, VerificationTier>>(TIERS_KEY, {});
  const out: Record<string, VerificationTier> = {};
  for (const id of new Set(userIds)) out[id] = tiers[id] ?? "free";
  return out;
}

export async function setTier(userId: string, tier: VerificationTier | null): Promise<void> {
  const tiers = await read<Record<string, VerificationTier>>(TIERS_KEY, {});
  if (tier) tiers[userId] = tier;
  else delete tiers[userId];
  await write(TIERS_KEY, tiers);

  const paintsBlue = tier === "verified" || tier === "premium";
  await db.profile
    .update({ where: { userId }, data: { verified: paintsBlue } })
    .catch(() => {});
}

/** Every active account has at least free verification. */
export async function hasVerification(
  userId: string,
  minimum: VerificationTier = "free",
): Promise<boolean> {
  return TIER_RANK[await getTier(userId)] >= TIER_RANK[minimum];
}

/** Has the user acknowledged the verification explainer popup? */
export async function hasClaimed(userId: string): Promise<boolean> {
  const claimed = await read<string[]>(CLAIMED_KEY, []);
  return claimed.includes(userId);
}

export async function claimVerification(userId: string): Promise<void> {
  const claimed = await read<string[]>(CLAIMED_KEY, []);
  if (!claimed.includes(userId)) {
    claimed.push(userId);
    await write(CLAIMED_KEY, claimed);
  }
  // Ensure the baseline tier is explicitly recorded.
  await setTier(userId, await getTier(userId));
}
