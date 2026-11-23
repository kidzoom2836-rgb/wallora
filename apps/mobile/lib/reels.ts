import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * WALLORA Reels data layer.
 *
 * Sources are royalty-free vertical clips only:
 *  - Pexels Video API (free key, direct MP4 links, attribution supported)
 *  - Pixabay Video API (free key, `orientation=vertical`)
 *  - A verified public Pexels MP4 set so the feed works without any key.
 *
 * No TV streams, no scraped drama APIs and no paywall circumvention.
 */

export type ReelProvider = "pexels" | "pixabay";

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

/** Verified 9:16 Pexels MP4s (HTTP 206, video/mp4) used when no key is set. */
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
  return value === "pixabay" ? "pixabay" : "pexels";
}

export async function setReelsProvider(provider: ReelProvider): Promise<void> {
  await AsyncStorage.setItem(PROVIDER_KEY, provider).catch(() => {});
}

export async function getReelsApiKey(provider: ReelProvider): Promise<string> {
  const key = provider === "pexels" ? PEXELS_KEY : PIXABAY_KEY;
  const stored = await AsyncStorage.getItem(key).catch(() => null);
  return stored ?? "";
}

export async function setReelsApiKey(provider: ReelProvider, value: string): Promise<void> {
  const key = provider === "pexels" ? PEXELS_KEY : PIXABAY_KEY;
  const trimmed = value.trim();
  if (trimmed) await AsyncStorage.setItem(key, trimmed).catch(() => {});
  else await AsyncStorage.removeItem(key).catch(() => {});
}

function pickVerticalPexelsFile(files: any[]) {
  const mp4s = files.filter(
    (file) => file?.file_type === "video/mp4" && !!file?.link,
  );
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
  url.searchParams.set("query", query || "vertical lifestyle");
  url.searchParams.set("orientation", "portrait");
  url.searchParams.set("per_page", "20");
  url.searchParams.set("page", String(page));
  const response = await fetch(url.toString(), {
    headers: { Authorization: apiKey, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Pexels request failed (${response.status}).`);
  const json: any = await response.json();
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

/** Pixabay: `GET /api/videos/?key=&orientation=vertical&per_page=` */
async function fetchPixabay(apiKey: string, query: string, page: number): Promise<StockReel[]> {
  const url = new URL("https://pixabay.com/api/videos/");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", query || "vertical");
  url.searchParams.set("orientation", "vertical");
  url.searchParams.set("per_page", "20");
  url.searchParams.set("page", String(page));
  const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Pixabay request failed (${response.status}).`);
  const json: any = await response.json();
  const hits: any[] = Array.isArray(json?.hits) ? json.hits : [];
  return hits
    .map((hit): StockReel | null => {
      const variants = [hit?.videos?.large, hit?.videos?.medium, hit?.videos?.small];
      const file = variants.find((variant) => {
        const width = variant?.width ?? 0;
        const height = variant?.height ?? 0;
        return !!variant?.url && height >= width;
      });
      if (!file?.url) return null;
      return {
        id: `pixabay-${hit.id}`,
        uri: file.url,
        title: (hit.tags ?? "Pixabay video")
          .split(",")
          .slice(0, 3)
          .join(" · "),
        creator: hit.user ?? "Pixabay creator",
        source: "pixabay",
        durationSec: typeof hit.duration === "number" ? hit.duration : undefined,
        creditUrl: `https://pixabay.com/videos/${hit.id}/`,
      };
    })
    .filter((reel): reel is StockReel => reel !== null);
}

export type LoadReelsResult = {
  reels: StockReel[];
  provider: ReelProvider | "sample";
  error?: string;
};

/** Fetch a reel page with a graceful sample fallback. */
export async function loadStockReels(options: {
  provider: ReelProvider;
  query?: string;
  page?: number;
}): Promise<LoadReelsResult> {
  const page = Math.max(1, options.page ?? 1);
  const apiKey = await getReelsApiKey(options.provider);
  if (!apiKey) {
    return { reels: SAMPLE_REELS, provider: "sample" };
  }
  try {
    const reels =
      options.provider === "pexels"
        ? await fetchPexels(apiKey, options.query ?? "", page)
        : await fetchPixabay(apiKey, options.query ?? "", page);
    if (!reels.length) return { reels: SAMPLE_REELS, provider: "sample" };
    return { reels, provider: options.provider };
  } catch (error) {
    return {
      reels: SAMPLE_REELS,
      provider: "sample",
      error: error instanceof Error ? error.message : "Could not load reels.",
    };
  }
}
