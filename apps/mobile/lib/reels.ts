import AsyncStorage from "@react-native-async-storage/async-storage";

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
const YOUTUBE_KEY = "wallora.reels.youtubeKey.v1";
const PEXELS_KEY = "wallora.reels.pexelsKey.v1";
const PIXABAY_KEY = "wallora.reels.pixabayKey.v1";
const INTERESTS_KEY = "wallora.reels.interests.v1";
const AFFINITY_KEY = "wallora.reels.affinity.v1";
const SEEN_KEY = "wallora.reels.seen.v1";
const POSITION_KEY = "wallora.reels.position.v1";
const VISIT_KEY = "wallora.reels.visits.v1";
const AUTO_ADVANCE_KEY = "wallora.reels.autoAdvance.v1";
const CACHE_PREFIX = "wallora.reels.cache.v4";

/** Set in a gitignored apps/mobile/.env for local testing. */
const DEFAULT_YOUTUBE_KEY = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY ?? "";
/** Built-in free Pixabay key so stock reels work out of the box. */
const DEFAULT_PIXABAY_KEY = "58789810-642de2f0ebbd0bb0c89a873db";

/** Pixabay policy: cache API responses for at least 24 hours. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Keep reels scrollable on ~1 Mbps connections by skipping oversized renditions. */
const MAX_REEL_BYTES = 12 * 1024 * 1024;

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

export async function getReelsApiKey(provider: ReelProvider): Promise<string> {
  const storageKey =
    provider === "youtube" ? YOUTUBE_KEY : provider === "pexels" ? PEXELS_KEY : PIXABAY_KEY;
  const stored = await AsyncStorage.getItem(storageKey).catch(() => null);
  if (stored) return stored;
  if (provider === "youtube") return DEFAULT_YOUTUBE_KEY;
  if (provider === "pixabay") return DEFAULT_PIXABAY_KEY;
  return "";
}

export async function setReelsApiKey(provider: ReelProvider, value: string): Promise<void> {
  const storageKey =
    provider === "youtube" ? YOUTUBE_KEY : provider === "pexels" ? PEXELS_KEY : PIXABAY_KEY;
  const trimmed = value.trim();
  if (trimmed) await AsyncStorage.setItem(storageKey, trimmed).catch(() => {});
  else await AsyncStorage.removeItem(storageKey).catch(() => {});
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

// ---------------------------------------------------------------------------
// Shared fetch helpers
// ---------------------------------------------------------------------------

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = text?.trim() || `Request failed (${response.status}).`;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.error?.message ?? parsed?.message ?? message;
    } catch {
      // Plain-text errors are valid for Pixabay.
    }
    throw new Error(message);
  }
  return response.json();
}

function parseIsoDuration(value?: string): number | undefined {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value ?? "");
  if (!match) return undefined;
  const total =
    Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return total > 0 ? total : undefined;
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

async function fetchYouTube(apiKey: string, query: string, page: number): Promise<StockReel[]> {
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("videoDuration", "short");
  searchUrl.searchParams.set("maxResults", "12");
  searchUrl.searchParams.set("q", query || "trending shorts");
  searchUrl.searchParams.set("key", apiKey);
  if (page > 1) searchUrl.searchParams.set("pageToken", String(page));

  const search = await fetchJson(searchUrl.toString(), { headers: { Accept: "application/json" } });
  const items: any[] = Array.isArray(search?.items) ? search.items : [];
  const ids = items.map((item) => item?.id?.videoId).filter(Boolean);
  if (!ids.length) return [];

  const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  detailsUrl.searchParams.set("part", "snippet,contentDetails,statistics");
  detailsUrl.searchParams.set("id", ids.join(","));
  detailsUrl.searchParams.set("key", apiKey);
  const details = await fetchJson(detailsUrl.toString(), { headers: { Accept: "application/json" } });
  const byId = new Map<string, any>(
    (Array.isArray(details?.items) ? details.items : []).map((item: any) => [item?.id, item]),
  );

  return items
    .map((item): StockReel | null => {
      const videoId = item?.id?.videoId as string | undefined;
      if (!videoId) return null;
      const detail = byId.get(videoId) ?? item;
      const snippet = detail?.snippet ?? item?.snippet ?? {};
      const durationSec = parseIsoDuration(detail?.contentDetails?.duration);
      if (durationSec && durationSec > 180) return null;

      const tags: string[] = Array.isArray(snippet?.tags)
        ? snippet.tags.filter((tag: unknown): tag is string => typeof tag === "string").slice(0, 8)
        : [];
      const reel: StockReel = {
        id: `youtube-${videoId}`,
        videoId,
        uri: `https://www.youtube.com/embed/${videoId}`,
        title: snippet?.title ?? "YouTube Short",
        creator: snippet?.channelTitle ?? "YouTube creator",
        source: "youtube",
        durationSec,
        creditUrl: `https://www.youtube.com/watch?v=${videoId}`,
        topics: [...new Set([query.toLowerCase(), ...tags.map((tag) => tag.toLowerCase())])],
        viewCount: Number(detail?.statistics?.viewCount ?? 0) || 0,
        sourceQuery: query,
      };
      const thumb =
        snippet?.thumbnails?.medium?.url ??
        snippet?.thumbnails?.high?.url ??
        snippet?.thumbnails?.default?.url;
      if (typeof thumb === "string") reel.poster = thumb;
      return reel;
    })
    .filter((reel): reel is StockReel => reel !== null);
}

function pickVerticalPexelsFile(files: any[]) {
  const mp4s = files.filter((file) => file?.file_type === "video/mp4" && !!file?.link);
  return (
    mp4s.find((file) => file.height === 1920 && file.width === 1080) ??
    mp4s.find((file) => (file.height ?? 0) > (file.width ?? 0)) ??
    mp4s[0] ??
    null
  );
}

async function fetchPexels(apiKey: string, query: string, page: number): Promise<StockReel[]> {
  const url = new URL("https://api.pexels.com/videos/search");
  url.searchParams.set("query", query || "vertical nature");
  url.searchParams.set("orientation", "portrait");
  url.searchParams.set("per_page", "20");
  url.searchParams.set("page", String(page));
  const json = await fetchJson(url.toString(), {
    headers: { Authorization: apiKey, Accept: "application/json" },
  });
  const videos: any[] = Array.isArray(json?.videos) ? json.videos : [];
  return videos
    .map((video): StockReel | null => {
      const file = pickVerticalPexelsFile(video?.video_files ?? []);
      if (!file?.link) return null;
      const reel: StockReel = {
        id: `pexels-${video.id}`,
        uri: file.link,
        title: (video.url ?? "Pexels video").split("/").pop()?.replace(/-/g, " ") ?? "Pexels video",
        creator: video.user?.name ?? "Pexels creator",
        source: "pexels",
        durationSec: typeof video.duration === "number" ? video.duration : undefined,
        creditUrl: video.url ?? undefined,
        topics: query ? [query.toLowerCase()] : undefined,
        sourceQuery: query,
      };
      if (typeof video.image === "string") reel.poster = video.image;
      return reel;
    })
    .filter((reel): reel is StockReel => reel !== null);
}

/**
 * Pick a vertical MP4 rendition that is small enough for smooth mobile
 * scrolling. Pixabay "medium" files can exceed 100 MB.
 */
function pickVerticalPixabayFile(videos: any) {
  const renditions = ["large", "medium", "small", "tiny"]
    .map((key) => videos?.[key])
    .filter(
      (file) =>
        !!file?.url &&
        (file.height ?? 0) >= (file.width ?? 0) &&
        (!file.size || file.size <= MAX_REEL_BYTES),
    );
  if (!renditions.length) return null;

  const tallEnough = renditions.filter((file) => (file.height ?? 0) >= 720);
  return (tallEnough.length ? tallEnough : renditions).sort(
    (a, b) => (a.size ?? 0) - (b.size ?? 0),
  )[0];
}

async function fetchPixabay(apiKey: string, query: string, page: number): Promise<StockReel[]> {
  const url = new URL("https://pixabay.com/api/videos/");
  url.searchParams.set("key", apiKey);
  if (query) url.searchParams.set("q", query);
  url.searchParams.set("orientation", "vertical");
  url.searchParams.set("safesearch", "true");
  // Pixabay's orientation filter is loose; a 20-result page can contain only
  // ~4 portrait renditions. Fetch the max allowed page and filter locally.
  url.searchParams.set("per_page", "200");
  url.searchParams.set("page", String(page));
  const json = await fetchJson(url.toString(), { headers: { Accept: "application/json" } });
  const hits: any[] = Array.isArray(json?.hits) ? json.hits : [];
  return hits
    .map((hit): StockReel | null => {
      const file = pickVerticalPixabayFile(hit?.videos);
      if (!file?.url) return null;
      const tags = typeof hit.tags === "string" ? hit.tags.split(",").slice(0, 8) : [];
      const reel: StockReel = {
        id: `pixabay-${hit.id}`,
        uri: file.url,
        title: tags.slice(0, 3).join(" · ") || "Pixabay video",
        creator: hit.user ?? "Pixabay creator",
        source: "pixabay",
        durationSec: typeof hit.duration === "number" ? hit.duration : undefined,
        creditUrl: hit.pageURL ?? `https://pixabay.com/videos/${hit.id}/`,
        topics: tags.map((tag: string) => tag.trim().toLowerCase()),
        sourceQuery: query,
      };
      if (typeof file.thumbnail === "string") reel.poster = file.thumbnail;
      return reel;
    })
    .filter((reel): reel is StockReel => reel !== null);
}

export type LoadReelsResult = {
  reels: StockReel[];
  provider: ReelProvider | "sample";
  error?: string;
  cached?: boolean;
};

/** Fetch one provider page with a 24-hour cache and offline fallbacks. */
export async function loadStockReels(options: {
  provider: ReelProvider;
  query?: string;
  page?: number;
  force?: boolean;
}): Promise<LoadReelsResult> {
  const page = Math.max(1, options.page ?? 1);
  const query = options.query ?? "";
  const apiKey = await getReelsApiKey(options.provider);
  const cached = await readCache(options.provider, query, page);
  const cacheFresh =
    !!cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS && cached.reels.length > 0;

  if (cacheFresh && !options.force) {
    return { reels: cached!.reels, provider: options.provider, cached: true };
  }

  if (!apiKey) {
    if (cached?.reels.length) return { reels: cached.reels, provider: options.provider, cached: true };
    if (options.provider === "youtube") {
      const stock = await loadStockReels({ provider: "pixabay", query, page, force: options.force });
      return { ...stock, error: stock.error ?? "YouTube key not set — showing Pixabay clips." };
    }
    return { reels: SAMPLE_REELS, provider: "sample" };
  }

  try {
    const reels =
      options.provider === "youtube"
        ? await fetchYouTube(apiKey, query, page)
        : options.provider === "pixabay"
          ? await fetchPixabay(apiKey, query, page)
          : await fetchPexels(apiKey, query, page);
    if (!reels.length) {
      if (cached?.reels.length) return { reels: cached.reels, provider: options.provider, cached: true };
      if (options.provider === "youtube") {
        return loadStockReels({ provider: "pixabay", query, page, force: options.force });
      }
      return { reels: SAMPLE_REELS, provider: "sample" };
    }
    await writeCache(options.provider, query, page, reels);
    return { reels, provider: options.provider };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load reels.";
    if (cached?.reels.length) {
      return { reels: cached.reels, provider: options.provider, cached: true, error: message };
    }
    if (options.provider === "youtube") {
      const stock = await loadStockReels({ provider: "pixabay", query, page, force: options.force });
      return { ...stock, error: message };
    }
    return { reels: SAMPLE_REELS, provider: "sample", error: message };
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
