import { db } from "@/lib/db";

/**
 * Expo push token registry.
 *
 * Stored in a single StoredBlob JSON document keyed by user ID so WALLORA can
 * add push support without a Prisma migration. Registration is best-effort:
 * a corrupt blob falls back to an empty registry rather than breaking auth.
 */

export const PUSH_TOKENS_KEY = "system:expo-push-tokens";
const MAX_TOKENS_PER_USER = 8;

export type PushTokenRecord = {
  token: string;
  platform?: string;
  createdAt: string;
  updatedAt: string;
};

export type PushTokenRegistry = Record<string, PushTokenRecord[]>;

export function isExpoPushToken(token: unknown): token is string {
  return typeof token === "string" && /^ExponentPushToken\[[^\]]+\]$/.test(token);
}

async function readRegistry(): Promise<PushTokenRegistry> {
  const blob = await db.storedBlob.findUnique({
    where: { key: PUSH_TOKENS_KEY },
    select: { data: true },
  });
  if (!blob) return {};
  try {
    const parsed = JSON.parse(Buffer.from(blob.data).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const clean: PushTokenRegistry = {};
    for (const [userId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue;
      clean[userId] = value
        .filter((item): item is PushTokenRecord => {
          if (!item || typeof item !== "object") return false;
          const record = item as Partial<PushTokenRecord>;
          return isExpoPushToken(record.token);
        })
        .map((item) => ({
          token: item.token,
          platform: typeof item.platform === "string" ? item.platform : undefined,
          createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
          updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
        }));
    }
    return clean;
  } catch {
    return {};
  }
}

async function writeRegistry(registry: PushTokenRegistry): Promise<void> {
  const data = Buffer.from(JSON.stringify(registry), "utf8");
  await db.storedBlob.upsert({
    where: { key: PUSH_TOKENS_KEY },
    update: { data, contentType: "application/json", size: data.length },
    create: { key: PUSH_TOKENS_KEY, data, contentType: "application/json", size: data.length },
  });
}

export async function registerPushToken(
  userId: string,
  token: string,
  platform?: string,
): Promise<number> {
  if (!isExpoPushToken(token)) return listUserTokens(userId).then((tokens) => tokens.length);
  const registry = await readRegistry();
  const now = new Date().toISOString();
  const existing = registry[userId] ?? [];
  const found = existing.find((item) => item.token === token);
  const next = found
    ? existing.map((item) =>
        item.token === token
          ? { ...item, platform: platform ?? item.platform, updatedAt: now }
          : item,
      )
    : [
        ...existing.filter((item) => item.token !== token),
        { token, platform, createdAt: now, updatedAt: now },
      ].slice(-MAX_TOKENS_PER_USER);

  registry[userId] = next;
  await writeRegistry(registry);
  return next.length;
}

export async function removePushToken(userId: string, token: string): Promise<number> {
  const registry = await readRegistry();
  registry[userId] = (registry[userId] ?? []).filter((item) => item.token !== token);
  if (registry[userId].length === 0) delete registry[userId];
  await writeRegistry(registry);
  return registry[userId]?.length ?? 0;
}

export async function listUserTokens(userId: string): Promise<string[]> {
  const registry = await readRegistry();
  return (registry[userId] ?? []).map((item) => item.token);
}

/** Remove every device token for an account that was deleted. */
export async function clearPushTokensForUser(userId: string): Promise<void> {
  const registry = await readRegistry();
  if (!registry[userId]) return;
  delete registry[userId];
  await writeRegistry(registry);
}

/** Remove tokens rejected by Expo (DeviceNotRegistered) from the registry. */
export async function removeInvalidTokens(invalid: string[]): Promise<number> {
  if (invalid.length === 0) return 0;
  const bad = new Set(invalid);
  const registry = await readRegistry();
  let removed = 0;
  for (const [userId, tokens] of Object.entries(registry)) {
    const next = tokens.filter((item) => {
      if (!bad.has(item.token)) return true;
      removed += 1;
      return false;
    });
    if (next.length) registry[userId] = next;
    else delete registry[userId];
  }
  if (removed) await writeRegistry(registry);
  return removed;
}

/** Only users who still have push enabled receive notifications. */
export async function resolveEnabledTokens(userIds: string[]): Promise<Map<string, string[]>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return new Map();

  const [enabled, registry] = await Promise.all([
    db.userSettings.findMany({
      where: { userId: { in: unique }, pushNotifications: true },
      select: { userId: true },
    }),
    readRegistry(),
  ]);

  const result = new Map<string, string[]>();
  for (const { userId } of enabled) {
    const tokens = (registry[userId] ?? []).map((item) => item.token);
    if (tokens.length) result.set(userId, tokens);
  }
  return result;
}

export async function listPushEnabledUserIds(): Promise<string[]> {
  const settings = await db.userSettings.findMany({
    where: { pushNotifications: true },
    select: { userId: true },
  });
  const registry = await readRegistry();
  return settings
    .map((item) => item.userId)
    .filter((userId) => (registry[userId]?.length ?? 0) > 0);
}
