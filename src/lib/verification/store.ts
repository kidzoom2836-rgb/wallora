import { db } from "@/lib/db";

/**
 * Verification applications and tiers, stored in StoredBlob so no Prisma
 * migration is needed. The existing `profile.verified` boolean remains the
 * source of truth for the blue tick; the tier adds a Premium level.
 */

export type VerificationTier = "verified" | "premium";
export type VerificationStatus = "pending" | "approved" | "rejected";

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
    await db.profile
      .update({
        where: { userId: updated.userId },
        data: { verified: true },
      })
      .catch(() => {});
    const tiers = await read<Record<string, VerificationTier>>(TIERS_KEY, {});
    tiers[updated.userId] = updated.tier;
    await write(TIERS_KEY, tiers);
  }
  return updated;
}

export async function getTier(userId: string): Promise<VerificationTier | null> {
  const tiers = await read<Record<string, VerificationTier>>(TIERS_KEY, {});
  return tiers[userId] ?? null;
}

export async function setTier(userId: string, tier: VerificationTier | null): Promise<void> {
  const tiers = await read<Record<string, VerificationTier>>(TIERS_KEY, {});
  if (tier) tiers[userId] = tier;
  else delete tiers[userId];
  await write(TIERS_KEY, tiers);
  await db.profile
    .update({
      where: { userId },
      data: { verified: !!tier },
    })
    .catch(() => {});
}
