import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/reels/search?provider=youtube|pixabay|pexels&q=...&page=1
 *
 * Server-only proxy for WALLORA Reels. Provider credentials stay on the server
 * and are never returned to the client or embedded in the mobile bundle.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type ReelProvider = "youtube" | "pixabay" | "pexels";

type Reel = {
  id: string;
  uri: string;
  poster?: string;
  title: string;
  creator: string;
  source: ReelProvider;
  durationSec?: number;
  creditUrl?: string;
  videoId?: string;
  topics?: string[];
  viewCount?: number;
  sourceQuery?: string;
};

const PROVIDERS = new Set<ReelProvider>(["youtube", "pixabay", "pexels"]);
const MAX_REEL_BYTES = 12 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
};

function serverKey(provider: ReelProvider): string | undefined {
  if (provider === "youtube") return process.env.YOUTUBE_API_KEY;
  if (provider === "pixabay") return process.env.PIXABAY_API_KEY;
  return process.env.PEXELS_API_KEY;
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    // Never echo provider response bodies: they can include the request URL/key.
    throw new Error(`Provider returned ${response.status}.`);
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

async function fetchYouTube(apiKey: string, query: string): Promise<Reel[]> {
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("videoDuration", "short");
  searchUrl.searchParams.set("maxResults", "12");
  searchUrl.searchParams.set("q", query || "trending shorts");
  searchUrl.searchParams.set("key", apiKey);

  const search = await fetchJson(searchUrl.toString(), {
    headers: { Accept: "application/json" },
  });
  const items: any[] = Array.isArray(search?.items) ? search.items : [];
  const ids = items.map((item) => item?.id?.videoId).filter(Boolean);
  if (!ids.length) return [];

  const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  detailsUrl.searchParams.set("part", "snippet,contentDetails,statistics");
  detailsUrl.searchParams.set("id", ids.join(","));
  detailsUrl.searchParams.set("key", apiKey);
  const details = await fetchJson(detailsUrl.toString(), {
    headers: { Accept: "application/json" },
  });
  const byId = new Map<string, any>(
    (Array.isArray(details?.items) ? details.items : []).map((item: any) => [item?.id, item]),
  );

  return items
    .map((item): Reel | null => {
      const videoId = item?.id?.videoId as string | undefined;
      if (!videoId) return null;
      const detail = byId.get(videoId) ?? item;
      const snippet = detail?.snippet ?? item?.snippet ?? {};
      const durationSec = parseIsoDuration(detail?.contentDetails?.duration);
      if (durationSec && durationSec > 180) return null;

      const tags: string[] = Array.isArray(snippet?.tags)
        ? snippet.tags.filter((tag: unknown): tag is string => typeof tag === "string").slice(0, 8)
        : [];
      const reel: Reel = {
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
    .filter((reel): reel is Reel => reel !== null);
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

async function fetchPexels(apiKey: string, query: string, page: number): Promise<Reel[]> {
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
    .map((video): Reel | null => {
      const file = pickVerticalPexelsFile(video?.video_files ?? []);
      if (!file?.link) return null;
      const reel: Reel = {
        id: `pexels-${video.id}`,
        uri: file.link,
        title: String(video.url ?? "Pexels video").split("/").pop()?.replace(/-/g, " ") ?? "Pexels video",
        creator: video.user?.name ?? "Pexels creator",
        source: "pexels",
        durationSec: typeof video.duration === "number" ? video.duration : undefined,
        creditUrl: typeof video.url === "string" ? video.url : undefined,
        topics: query ? [query.toLowerCase()] : undefined,
        sourceQuery: query,
      };
      if (typeof video.image === "string") reel.poster = video.image;
      return reel;
    })
    .filter((reel): reel is Reel => reel !== null);
}

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

async function fetchPixabay(apiKey: string, query: string, page: number): Promise<Reel[]> {
  const url = new URL("https://pixabay.com/api/videos/");
  url.searchParams.set("key", apiKey);
  if (query) url.searchParams.set("q", query);
  url.searchParams.set("orientation", "vertical");
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("per_page", "200");
  url.searchParams.set("page", String(page));
  const json = await fetchJson(url.toString(), { headers: { Accept: "application/json" } });
  const hits: any[] = Array.isArray(json?.hits) ? json.hits : [];
  return hits
    .map((hit): Reel | null => {
      const file = pickVerticalPixabayFile(hit?.videos);
      if (!file?.url) return null;
      const tags = typeof hit.tags === "string" ? hit.tags.split(",").slice(0, 8) : [];
      const reel: Reel = {
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
    .filter((reel): reel is Reel => reel !== null);
}

export async function GET(request: NextRequest) {
  const rawProvider = request.nextUrl.searchParams.get("provider") ?? "youtube";
  const provider: ReelProvider = PROVIDERS.has(rawProvider as ReelProvider)
    ? (rawProvider as ReelProvider)
    : "youtube";
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  const page = Math.min(20, Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1));

  const apiKey = serverKey(provider);
  if (!apiKey) {
    return NextResponse.json(
      {
        reels: [],
        provider,
        error: `${provider} credentials are not configured on the WALLORA server.`,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const reels =
      provider === "youtube"
        ? await fetchYouTube(apiKey, query)
        : provider === "pixabay"
          ? await fetchPixabay(apiKey, query, page)
          : await fetchPexels(apiKey, query, page);
    return NextResponse.json({ reels, provider }, { status: 200, headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { reels: [], provider, error: `Could not load ${provider} reels right now.` },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
