/**
 * WALLORA Live TV — local watch analytics and channel ranking.
 *
 * Everything is stored on device with AsyncStorage. The ranking formula is
 * intentionally transparent so it can later be swapped for a backend signal:
 *
 *   score = watchCount * 4 + watchSeconds / 30 + favoriteBoost * 8 + recencyBoost
 *
 * `recencyBoost` starts at 12 and decays to 0 over the following 12 hours.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { uniqueChannelId, type IptvChannel } from "./iptv";

const WATCH_STATS_KEY = "wallora.tv.watchStats.v1";
const COMMUNITY_LIKES_KEY = "wallora.tv.communityLikes.v1";

const HOUR_MS = 60 * 60 * 1000;
const SESSION_GAP_MS = 60 * 1000;
const RECENCY_WINDOW_HOURS = 12;
const RECENCY_MAX = 12;

/** Persistent per-channel stats used by the ranking algorithm. */
export type ChannelStats = {
  channelId: string;
  watchCount: number;
  watchSeconds: number;
  lastWatchedAt: number;
  favoriteBoost: number;
};

/** Local placeholder for backend community likes, keyed by channel id. */
export type CommunityLikes = Record<string, number>;

/** A playlist channel decorated with the signals used to rank it. */
export type RankedChannel = IptvChannel & {
  score: number;
  watchStats?: ChannelStats;
  communityLikes: number;
};

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function recencyBoost(lastWatchedAt: number | undefined, now: number): number {
  if (!lastWatchedAt || lastWatchedAt <= 0) return 0;
  const hoursAge = Math.max(0, (now - lastWatchedAt) / HOUR_MS);
  return Math.max(0, RECENCY_MAX - (hoursAge / RECENCY_WINDOW_HOURS) * RECENCY_MAX);
}

/** Score used by `rankChannels`. Exported for debugging / UI explanations. */
export function scoreForStats(
  stats: Pick<ChannelStats, "watchCount" | "watchSeconds" | "favoriteBoost" | "lastWatchedAt"> | undefined,
  now = Date.now(),
): number {
  if (!stats) return 0;
  const watchCount = Math.max(0, finiteNumber(stats.watchCount));
  const watchSeconds = Math.max(0, finiteNumber(stats.watchSeconds));
  const favoriteBoost = Math.max(0, finiteNumber(stats.favoriteBoost));
  return (
    watchCount * 4 +
    watchSeconds / 30 +
    favoriteBoost * 8 +
    recencyBoost(stats.lastWatchedAt, now)
  );
}

/** Read all local watch stats. Always resolves to a safe array. */
export async function getChannelStats(): Promise<ChannelStats[]> {
  try {
    const raw = await AsyncStorage.getItem(WATCH_STATS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const byId = new Map<string, ChannelStats>();
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const candidate = item as Partial<ChannelStats>;
      if (typeof candidate.channelId !== "string" || !candidate.channelId) continue;
      const current = byId.get(candidate.channelId);
      const next: ChannelStats = {
        channelId: candidate.channelId,
        watchCount: Math.max(0, finiteNumber(candidate.watchCount)),
        watchSeconds: Math.max(0, finiteNumber(candidate.watchSeconds)),
        lastWatchedAt: Math.max(0, finiteNumber(candidate.lastWatchedAt)),
        favoriteBoost: Math.max(0, Math.min(1, finiteNumber(candidate.favoriteBoost))),
      };
      byId.set(candidate.channelId, current ? mergeStats(current, next) : next);
    }
    return Array.from(byId.values());
  } catch {
    return [];
  }
}

function mergeStats(a: ChannelStats, b: ChannelStats): ChannelStats {
  return {
    channelId: a.channelId,
    watchCount: a.watchCount + b.watchCount,
    watchSeconds: a.watchSeconds + b.watchSeconds,
    lastWatchedAt: Math.max(a.lastWatchedAt, b.lastWatchedAt),
    favoriteBoost: Math.max(a.favoriteBoost, b.favoriteBoost),
  };
}

async function writeStats(stats: ChannelStats[]): Promise<void> {
  try {
    await AsyncStorage.setItem(WATCH_STATS_KEY, JSON.stringify(stats));
  } catch {
    // Analytics should never break playback.
  }
}

/**
 * Add watch time for a channel. A "watch" (session) is counted at most once
 * per minute so the 5-second player interval does not inflate watchCount.
 */
export async function recordWatch(channelId: string, seconds: number): Promise<void> {
  const id = channelId.trim();
  const amount = Math.max(0, Math.min(3600, finiteNumber(seconds)));
  if (!id || amount <= 0) return;

  const stats = await getChannelStats();
  const byId = new Map(stats.map((item) => [item.channelId, { ...item }]));
  const current =
    byId.get(id) ??
    ({
      channelId: id,
      watchCount: 0,
      watchSeconds: 0,
      lastWatchedAt: 0,
      favoriteBoost: 0,
    } satisfies ChannelStats);
  const now = Date.now();
  const isNewSession =
    !current.lastWatchedAt || now - current.lastWatchedAt > SESSION_GAP_MS;

  byId.set(id, {
    ...current,
    watchCount: current.watchCount + (isNewSession ? 1 : 0),
    watchSeconds: current.watchSeconds + amount,
    lastWatchedAt: now,
  });
  await writeStats(Array.from(byId.values()));
}

/** Keep the ranking's favorite signal in sync with iptv favorites. */
export async function setFavoriteBoost(channelId: string, active: boolean): Promise<void> {
  const id = channelId.trim();
  if (!id) return;

  const stats = await getChannelStats();
  const byId = new Map(stats.map((item) => [item.channelId, { ...item }]));
  const current =
    byId.get(id) ??
    ({
      channelId: id,
      watchCount: 0,
      watchSeconds: 0,
      lastWatchedAt: 0,
      favoriteBoost: 0,
    } satisfies ChannelStats);

  byId.set(id, { ...current, favoriteBoost: active ? 1 : 0 });
  await writeStats(Array.from(byId.values()));
}

/**
 * Backend likes are not wired up yet. This reads a local map so the UI can
 * already merge community signals when the API becomes available.
 */
export async function getCommunityLikes(): Promise<CommunityLikes> {
  try {
    const raw = await AsyncStorage.getItem(COMMUNITY_LIKES_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const result: CommunityLikes = {};
    for (const [key, value] of Object.entries(parsed)) {
      const likes = Math.max(0, Math.floor(finiteNumber(value)));
      if (key && likes > 0) result[key] = likes;
    }
    return result;
  } catch {
    return {};
  }
}

type InternalRankedChannel = RankedChannel & {
  __originalIndex?: number;
  __trend?: number;
};

function decorate(
  channels: IptvChannel[],
  stats: ChannelStats[],
  likes: CommunityLikes,
  now: number,
): InternalRankedChannel[] {
  const statsById = new Map(stats.map((item) => [item.channelId, item]));
  return channels.map((channel, originalIndex) => {
    const id = uniqueChannelId(channel);
    const watchStats = statsById.get(id);
    return {
      ...channel,
      score: scoreForStats(watchStats, now),
      watchStats,
      communityLikes: Math.max(0, finiteNumber(likes[id])),
      __originalIndex: originalIndex,
    };
  });
}

function stripInternal(channel: InternalRankedChannel): RankedChannel {
  const clean: InternalRankedChannel = { ...channel };
  delete clean.__originalIndex;
  delete clean.__trend;
  return clean;
}

/** Channels sorted by the documented WALLORA ranking score. */
export async function rankChannels(channels: IptvChannel[]): Promise<RankedChannel[]> {
  if (!channels.length) return [];
  const [stats, likes] = await Promise.all([getChannelStats(), getCommunityLikes()]);
  const now = Date.now();
  return decorate(channels, stats, likes, now)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.communityLikes - a.communityLikes ||
        (a.__originalIndex ?? 0) - (b.__originalIndex ?? 0),
    )
    .map(stripInternal);
}

/** Channels the user actually spent time watching, most-watched first. */
export async function getMostWatched(
  channels: IptvChannel[],
  limit = 12,
): Promise<RankedChannel[]> {
  if (!channels.length || limit <= 0) return [];
  const stats = await getChannelStats();
  const likes = await getCommunityLikes();
  const now = Date.now();
  return decorate(channels, stats, likes, now)
    .filter((channel) => (channel.watchStats?.watchSeconds ?? 0) > 0)
    .sort((a, b) => {
      const aStats = a.watchStats!;
      const bStats = b.watchStats!;
      const aWeight = aStats.watchSeconds + aStats.watchCount * 30;
      const bWeight = bStats.watchSeconds + bStats.watchCount * 30;
      return bWeight - aWeight || b.score - a.score;
    })
    .slice(0, limit)
    .map(stripInternal);
}

/** Recently watched + community-liked channels, with the base score as a tie-break. */
export async function getTrending(
  channels: IptvChannel[],
  limit = 12,
): Promise<RankedChannel[]> {
  if (!channels.length || limit <= 0) return [];
  const ranked = await rankChannels(channels);
  const now = Date.now();
  return ranked
    .map((channel): InternalRankedChannel => {
      const lastWatchedAt = channel.watchStats?.lastWatchedAt ?? 0;
      const recent = lastWatchedAt && now - lastWatchedAt < 7 * 24 * HOUR_MS;
      const trend = channel.score + (recent ? recencyBoost(lastWatchedAt, now) * 2 : 0);
      return {
        ...channel,
        __trend: trend + Math.min(20, channel.communityLikes / 10),
      };
    })
    .sort((a, b) => (b.__trend ?? 0) - (a.__trend ?? 0) || b.score - a.score)
    .slice(0, limit)
    .map(stripInternal);
}
