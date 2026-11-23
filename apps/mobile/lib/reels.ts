import AsyncStorage from "@react-native-async-storage/async-storage";

import { API_BASE } from "./config";

/**
 * WALLORA Reels data layer.
 *
 * Sources are royalty-free or creator-authorized vertical clips only:
 *  - YouTube Data API (`videoDuration=short`) for a personalized For You feed
 *  - Pixabay Video API (`orientation=vertical`) as the default stock fallback
 *  - Pexels Video API as an alternative stock source
 *  - A verified public Pexels MP4 set when no API is reachable
 *
 * No TV streams, no scraped drama APIs and no paywall circumvention.
 */

export type ReelProvider = "youtube" | "pixabay" | "pexels";

export type StockReel = {
  id: string;
  uri: string;
  poster?: string;
  title: string;
  creator: string;
  source: ReelProvider | "sample";
  durationSec?: number;
  creditUrl?: string;
  videoId?: string;
  topics?: string[];
  viewCount?: number;
  sourceQuery?: string;
};

const PROVIDER_KEY = "wallora.reels.provider.v1";
const INTERESTS_KEY = "wallora.reels.interests.v1";
const AFFINITY_KEY = "wallora.reels.affinity.v1";
const SEEN_KEY = "wallora.reels.seen.v1";
const POSITION_KEY = "wallora.reels.position.v1";
const VISIT_KEY = "wallora.reels.visits.v1";
const AUTO_ADVANCE_KEY = "wallora.reels.autoAdvance.v1";
const CACHE_PREFIX = "wallora.reels.cache.v5";


/** Pixabay policy: cache API responses for at least 24 hours. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_REEL_INTERESTS = [
  "funny shorts",
  "travel shorts",
  "music shorts",
  "sports shorts",
  "food shorts",
  "nature shorts",
  "dance shorts",
  "tech shorts",
  "animals shorts",
  "fitness shorts",
];

/** Verified 9:16 Pexels MP4s used only when no API is reachable. */
export const SAMPLE_REELS: StockReel[] = [
  {
    id: "pexels-4678261",
    uri: "https://videos.pexels.com/video-files/4678261/4678261-hd_1080_1920_25fps.mp4",
    title: "Golden hour by the water",
    creator: "Pexels creator",
    source: "sample",
    creditUrl: "https://www.pexels.com/video/4678261/",
  },
  {
    id: "pexels-3127177",
    uri: "https://videos.pexels.com/video-files/3127177/3127177-hd_1080_1920_24fps.mp4",
    title: "City lights after dark",
    creator: "Pexels creator",
    source: "sample",
    creditUrl: "https://www.pexels.com/video/3127177/",
  },
  {
    id: "pexels-7297870",
    uri: "https://videos.pexels.com/video-files/7297870/7297870-hd_1080_1920_30fps.mp4",
    title: "A quiet moment in motion",
    creator: "Pexels creator",
    source: "sample",
    creditUrl: "https://www.pexels.com/video/7297870/",
  },
  {
    id: "pexels-8671030",
    uri: "https://videos.pexels.com/video-files/8671030/8671030-hd_1080_1920_25fps.mp4",
    title: "Everyday vertical story",
    creator: "Pexels creator",
    source: "sample",
    creditUrl: "https://www.pexels.com/video/8671030/",
  },
  {
    id: "pexels-7565438",
    uri: "https://videos.pexels.com/video-files/7565438/7565438-hd_1080_1920_25fps.mp4",
    title: "A short vertical escape",
    creator: "Pexels creator",
    source: "sample",
    creditUrl: "https://www.pexels.com/video/7565438/",
  },
];

// ---------------------------------------------------------------------------
// Settings and preferences
// ---------------------------------------------------------------------------

export async function getReelsProvider(): Promise<ReelProvider> {
  const value = await AsyncStorage.getItem(PROVIDER_KEY).catch(() => null);
  if (value === "youtube" || value === "pixabay" || value === "pexels") return value;
  return "youtube";
}

export async function setReelsProvider(provider: ReelProvider): Promise<void> {
  await AsyncStorage.setItem(PROVIDER_KEY, provider).catch(() => {});
}

/** Provider credentials are server-only; no key is stored on the device. */
export function reelsUseServerKeys(): boolean {
  return true;
}

export async function getReelInterests(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(INTERESTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && !!item.trim()).slice(0, 12);
  } catch {
    return [];
  }
}

export async function setReelInterests(values: string[]): Promise<void> {
  const clean = [...new Set(values.map((v) => v.trim()).filter(Boolean))].slice(0, 12);
  await AsyncStorage.setItem(INTERESTS_KEY, JSON.stringify(clean)).catch(() => {});
}

export async function getReelAffinity(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(AFFINITY_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/** Likes teach the For You algorithm which topics to rank higher. */
export async function recordReelLike(reel: StockReel): Promise<void> {
  const topics = reel.topics ?? [];
  if (!topics.length) return;
  const current = await getReelAffinity();
  for (const topic of topics) current[topic] = (current[topic] ?? 0) + 1;
  await AsyncStorage.setItem(AFFINITY_KEY, JSON.stringify(current)).catch(() => {});
}

/** Skipping a reel quickly teaches the feed to show less of that topic. */
export async function recordReelSkip(reel: StockReel): Promise<void> {
  const topics = reel.topics ?? [];
  if (!topics.length) return;
  const current = await getReelAffinity();
  for (const topic of topics) {
    current[topic] = Math.max(-3, (current[topic] ?? 0) - 0.75);
  }
  await AsyncStorage.setItem(AFFINITY_KEY, JSON.stringify(current)).catch(() => {});
}

async function readStringArray(key: string): Promise<string[]> {
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(key)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/** Reels already shown are demoted so returning to the feed feels fresh. */
export async function getSeenReelIds(): Promise<Set<string>> {
  return new Set(await readStringArray(SEEN_KEY));
}

export async function markReelsSeen(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const seen = await readStringArray(SEEN_KEY);
  const merged = [...seen, ...ids].filter((id, index, all) => all.indexOf(id) === index).slice(-400);
  await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(merged)).catch(() => {});
}

/** Counts visits so the feed can rotate its starting point on every open. */
export async function nextReelVisit(): Promise<number> {
  const current = Number.parseInt((await AsyncStorage.getItem(VISIT_KEY)) ?? "0", 10) || 0;
  const next = current + 1;
  await AsyncStorage.setItem(VISIT_KEY, String(next)).catch(() => {});
  return next;
}

/** Restore the reel the user was on last time they opened Reels. */
export async function getReelPosition(): Promise<string | null> {
  return (await AsyncStorage.getItem(POSITION_KEY)) || null;
}

export async function setReelPosition(id: string | null): Promise<void> {
  if (!id) return;
  await AsyncStorage.setItem(POSITION_KEY, id).catch(() => {});
}

export async function getAutoAdvance(): Promise<boolean> {
  return (await AsyncStorage.getItem(AUTO_ADVANCE_KEY)) === "1";
}

export async function setAutoAdvance(value: boolean): Promise<void> {
  await AsyncStorage.setItem(AUTO_ADVANCE_KEY, value ? "1" : "0").catch(() => {});
}

// ---------------------------------------------------------------------------
// 24-hour cache (Pixabay/YouTube quota protection)
// ---------------------------------------------------------------------------

type CachedPage = { fetchedAt: number; reels: StockReel[] };

function cacheKey(provider: ReelProvider, query: string, page: number): string {
  return `${CACHE_PREFIX}:${provider}:${query || "all"}:${page}`;
}

async function readCache(provider: ReelProvider, query: string, page: number): Promise<CachedPage | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(provider, query, page));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPage;
    if (!Array.isArray(parsed?.reels) || typeof parsed.fetchedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(
  provider: ReelProvider,
  query: string,
  page: number,
  reels: StockReel[],
): Promise<void> {
  const payload: CachedPage = { fetchedAt: Date.now(), reels };
  await AsyncStorage.setItem(cacheKey(provider, query, page), JSON.stringify(payload)).catch(() => {});
}

export type LoadReelsResult = {
  reels: StockReel[];
  provider: ReelProvider | "sample";
  error?: string;
  cached?: boolean;
};

/** Fetch one provider page through the WALLORA server proxy with a 24-hour cache. */
export async function loadStockReels(options: {
  provider: ReelProvider;
  query?: string;
  page?: number;
  force?: boolean;
}): Promise<LoadReelsResult> {
  const page = Math.max(1, options.page ?? 1);
  const query = options.query ?? "";
  const cached = await readCache(options.provider, query, page);
  const cacheFresh =
    !!cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS && cached.reels.length > 0;

  if (cacheFresh && !options.force) {
    return { reels: cached!.reels, provider: options.provider, cached: true };
  }

  try {
    const base = API_BASE.replace(/\/$/, "");
    const url = `${base}/api/v1/reels/search?provider=${encodeURIComponent(
      options.provider,
    )}&q=${encodeURIComponent(query)}&page=${page}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Reels service returned ${response.status}.`);
    const data = await response.json();
    const reels: StockReel[] = Array.isArray(data?.reels) ? data.reels : [];

    if (!reels.length) {
      if (cached?.reels.length) {
        return { reels: cached.reels, provider: options.provider, cached: true };
      }
      if (options.provider === "youtube") {
        return loadStockReels({ provider: "pixabay", query, page, force: options.force });
      }
      return { reels: SAMPLE_REELS, provider: "sample" };
    }

    await writeCache(options.provider, query, page, reels);
    return {
      reels,
      provider: options.provider,
      error: typeof data?.error === "string" ? data.error : undefined,
    };
  } catch {
    if (cached?.reels.length) {
      return { reels: cached.reels, provider: options.provider, cached: true };
    }
    if (options.provider === "youtube") {
      return loadStockReels({ provider: "pixabay", query, page, force: options.force });
    }
    return { reels: SAMPLE_REELS, provider: "sample" };
  }
}


function reelScore(reel: StockReel, affinity: Record<string, number>, interests: string[]): number {
  const topics = reel.topics ?? [];
  const affinityScore = topics.reduce((sum, topic) => sum + (affinity[topic] ?? 0), 0);
  const interestScore = topics.some((topic) => interests.includes(topic)) ? 4 : 0;
  const popularity = Math.log10((reel.viewCount ?? 0) + 1) * 1.5;
  const shortBonus = reel.durationSec && reel.durationSec <= 60 ? 1 : 0;
  return affinityScore * 3 + interestScore + popularity + shortBonus;
}

/**
 * Personalized For You feed. Queries one page per saved interest, interleaves
 * the results for variety, then ranks them using likes and popularity.
 */
export async function loadPersonalizedReels(options: { force?: boolean } = {}): Promise<LoadReelsResult> {
  const [interests, affinity, seen, visit] = await Promise.all([
    getReelInterests(),
    getReelAffinity(),
    getSeenReelIds(),
    nextReelVisit(),
  ]);
  // Keep within YouTube's daily quota: each search costs ~100 units.
  const allQueries = (interests.length ? interests : DEFAULT_REEL_INTERESTS.slice(0, 5)).slice(0, 5);
  // Rotate which interests lead each visit so the feed never opens identically.
  const offset = allQueries.length ? visit % allQueries.length : 0;
  const queries = [...allQueries.slice(offset), ...allQueries.slice(0, offset)];
  const pages = await Promise.all(
    queries.map((query) => loadStockReels({ provider: "youtube", query, page: 1, force: options.force })),
  );

  const score = (reel: StockReel) =>
    reelScore(reel, affinity, allQueries) - (seen.has(reel.id) ? 4 : 0);
  const grouped = pages.map((page) => [...page.reels].sort((a, b) => score(b) - score(a)));
  const used = new Set<string>();
  const merged: StockReel[] = [];
  const maxLength = Math.max(0, ...grouped.map((list) => list.length));
  for (let index = 0; index < maxLength; index += 1) {
    for (let group = 0; group < grouped.length; group += 1) {
      const list = grouped[(group + visit) % grouped.length];
      const reel = list[index];
      if (!reel || used.has(reel.id)) continue;
      used.add(reel.id);
      merged.push(reel);
    }
  }

  // Start at a different point each visit while keeping the ranking intact.
  const rotation = merged.length ? (visit * 7) % merged.length : 0;
  const reels = [...merged.slice(rotation), ...merged.slice(0, rotation)];

  const errors = pages.map((page) => page.error).filter(Boolean) as string[];
  const provider = pages.some((page) => page.provider === "youtube") ? "youtube" : pages[0]?.provider ?? "sample";
  return {
    reels,
    provider,
    cached: pages.every((page) => page.cached),
    error: errors[0],
  };
}
