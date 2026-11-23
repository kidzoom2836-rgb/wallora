import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * WALLORA Reels data layer.
 *
 * Primary source is the Pixabay Video API (royalty-free, `orientation=vertical`,
 * direct MP4 embeds). Pexels is supported as an alternative. A verified public
 * Pexels MP4 set is kept as an offline fallback so the feed is never empty.
 *
 * Pixabay requires responses to be cached for 24 hours — implemented below
 * with AsyncStorage. Every reel keeps creator + creditUrl for attribution.
 *
 * No TV streams, no scraped drama APIs and no paywall circumvention.
 */

export type ReelProvider = "pixabay" | "pexels";

export type StockReel = {
  id: string;
  uri: string;
  poster?: string;
  title: string;
  creator: string;
  source: ReelProvider | "sample";
  durationSec?: number;
  creditUrl?: string;
};

const PROVIDER_KEY = "wallora.reels.provider.v1";
const PEXELS_KEY = "wallora.reels.pexelsKey.v1";
const PIXABAY_KEY = "wallora.reels.pixabayKey.v1";
const CACHE_PREFIX = "wallora.reels.cache.v1";

/** Built-in free Pixabay key so Reels work out of the box. Users can override it in Source settings. */
const DEFAULT_PIXABAY_KEY = "58789810-642de2f0ebbd0bb0c89a873db";

/** Pixabay policy: cache API responses for at least 24 hours. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Verified 9:16 Pexels MP4s used only when offline / no API is reachable. */
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

export async function getReelsProvider(): Promise<ReelProvider> {
  const value = await AsyncStorage.getItem(PROVIDER_KEY).catch(() => null);
  return value === "pexels" ? "pexels" : "pixabay";
}

export async function setReelsProvider(provider: ReelProvider): Promise<void> {
  await AsyncStorage.setItem(PROVIDER_KEY, provider).catch(() => {});
}

export async function getReelsApiKey(provider: ReelProvider): Promise<string> {
  const storageKey = provider === "pexels" ? PEXELS_KEY : PIXABAY_KEY;
  const stored = await AsyncStorage.getItem(storageKey).catch(() => null);
  if (stored) return stored;
  return provider === "pixabay" ? DEFAULT_PIXABAY_KEY : "";
}

export async function setReelsApiKey(provider: ReelProvider, value: string): Promise<void> {
  const storageKey = provider === "pexels" ? PEXELS_KEY : PIXABAY_KEY;
  const trimmed = value.trim();
  if (trimmed) await AsyncStorage.setItem(storageKey, trimmed).catch(() => {});
  else await AsyncStorage.removeItem(storageKey).catch(() => {});
}

// ---------------------------------------------------------------------------
// 24-hour cache (Pixabay requirement)
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
// Providers
// ---------------------------------------------------------------------------

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, init);
  if (!response.ok) {
    // Pixabay errors are plain text, not JSON.
    const text = await response.text().catch(() => "");
    throw new Error(text?.trim() || `Request failed (${response.status}).`);
  }
  return response.json();
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

/** Pexels: `GET /videos/search?query=&orientation=portrait&per_page=` */
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
      };
      if (typeof video.image === "string") reel.poster = video.image;
      return reel;
    })
    .filter((reel): reel is StockReel => reel !== null);
}

/**
 * Pick a vertical MP4 rendition. `medium` (~720p) is preferred for smooth
 * mobile scrolling and low data use; fall back to any portrait rendition.
 */
function pickVerticalPixabayFile(videos: any) {
  const order = ["medium", "small", "tiny", "large"];
  const renditions = order
    .map((key) => videos?.[key])
    .filter((file) => !!file?.url && (file.height ?? 0) >= (file.width ?? 0));
  return renditions[0] ?? null;
}

/** Pixabay: `GET /api/videos/?key=&orientation=vertical&safesearch=true` */
async function fetchPixabay(apiKey: string, query: string, page: number): Promise<StockReel[]> {
  const url = new URL("https://pixabay.com/api/videos/");
  url.searchParams.set("key", apiKey);
  if (query) url.searchParams.set("q", query);
  url.searchParams.set("orientation", "vertical");
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("per_page", "20");
  url.searchParams.set("page", String(page));
  const json = await fetchJson(url.toString(), { headers: { Accept: "application/json" } });
  const hits: any[] = Array.isArray(json?.hits) ? json.hits : [];
  return hits
    .map((hit): StockReel | null => {
      const file = pickVerticalPixabayFile(hit?.videos);
      if (!file?.url) return null;
      const reel: StockReel = {
        id: `pixabay-${hit.id}`,
        uri: file.url,
        title: (hit.tags ?? "Pixabay video").split(",").slice(0, 3).join(" · "),
        creator: hit.user ?? "Pixabay creator",
        source: "pixabay",
        durationSec: typeof hit.duration === "number" ? hit.duration : undefined,
        creditUrl: hit.pageURL ?? `https://pixabay.com/videos/${hit.id}/`,
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

/**
 * Fetch a reel page with a 24-hour cache, stale-cache fallback and an offline
 * sample fallback. `force` is used by pull-to-refresh for an explicit human request.
 */
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
    return { reels: SAMPLE_REELS, provider: "sample" };
  }

  try {
    const reels =
      options.provider === "pixabay"
        ? await fetchPixabay(apiKey, query, page)
        : await fetchPexels(apiKey, query, page);
    if (!reels.length) {
      if (cached?.reels.length) return { reels: cached.reels, provider: options.provider, cached: true };
      return { reels: SAMPLE_REELS, provider: "sample" };
    }
    await writeCache(options.provider, query, page, reels);
    return { reels, provider: options.provider };
  } catch (error) {
    // Serve stale cache before samples so the feed stays continuous.
    if (cached?.reels.length) {
      return {
        reels: cached.reels,
        provider: options.provider,
        cached: true,
        error: error instanceof Error ? error.message : "Could not refresh reels.",
      };
    }
    return {
      reels: SAMPLE_REELS,
      provider: "sample",
      error: error instanceof Error ? error.message : "Could not load reels.",
    };
  }
}
