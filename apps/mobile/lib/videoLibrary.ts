import AsyncStorage from "@react-native-async-storage/async-storage";

export type VideoItem = {
  id: string;
  title: string;
  uri: string;
  source: "demo" | "local" | "url";
  addedAt: number;
  favorite?: boolean;
};

export type ProgressEntry = {
  position: number;
  duration: number;
  updatedAt: number;
  completed?: boolean;
};

export const VIDEOS_KEY = "wallora.video.items.v1";
export const PROGRESS_KEY = "wallora.video.progress.v1";

export const DEMO_VIDEOS: VideoItem[] = [
  {
    id: "demo-bunny-hls",
    title: "Big Buck Bunny · HLS",
    uri: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    source: "demo",
    addedAt: 4,
  },
  {
    id: "demo-steel",
    title: "Tears of Steel · HLS",
    uri: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    source: "demo",
    addedAt: 3,
  },
  {
    id: "demo-angel",
    title: "Angel One · HLS",
    uri: "https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8",
    source: "demo",
    addedAt: 2,
  },
  {
    id: "demo-bunny-mp4",
    title: "Big Buck Bunny · MP4",
    uri: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    source: "demo",
    addedAt: 1,
  },
];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatTime(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0)
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatRate(rate: number): string {
  return `${Number((Number.isFinite(rate) ? rate : 1).toFixed(2))}×`;
}

export function makeId(uri: string): string {
  return `${Date.now().toString(36)}-${uri.length}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function titleFromUri(uri: string, fallback: string): string {
  try {
    const last = uri.split("?")[0].split("/").pop() ?? "";
    return (
      decodeURIComponent(last)
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim() || fallback
    );
  } catch {
    return fallback;
  }
}

export function isHls(uri: string): boolean {
  return /\.m3u8(\?|#|$)/i.test(uri);
}

export function sourceLabel(item: VideoItem): string {
  if (item.source === "local") return "On this device";
  if (item.source === "url") return "Network stream";
  return "Demo stream";
}

export function badgeFor(item: VideoItem): string {
  if (item.source === "local") return "FILE";
  if (isHls(item.uri)) return "HLS";
  return "STREAM";
}

export async function loadVideoLibrary(): Promise<VideoItem[]> {
  try {
    const raw = await AsyncStorage.getItem(VIDEOS_KEY);
    if (!raw) return DEMO_VIDEOS;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEMO_VIDEOS;
    const restored = parsed
      .filter(
        (entry): entry is VideoItem =>
          !!entry &&
          typeof entry === "object" &&
          typeof (entry as VideoItem).id === "string" &&
          typeof (entry as VideoItem).uri === "string" &&
          typeof (entry as VideoItem).title === "string",
      )
      .map((entry) => ({ ...entry, favorite: !!entry.favorite }));
    return restored.length ? restored : DEMO_VIDEOS;
  } catch {
    return DEMO_VIDEOS;
  }
}

export async function saveVideoLibrary(items: VideoItem[]): Promise<void> {
  await AsyncStorage.setItem(VIDEOS_KEY, JSON.stringify(items)).catch(() => {});
}

export async function loadVideoProgress(): Promise<Record<string, ProgressEntry>> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      return parsed as Record<string, ProgressEntry>;
  } catch {
    /* Corrupt storage should never block the library. */
  }
  return {};
}

export async function saveVideoProgress(
  progress: Record<string, ProgressEntry>,
): Promise<void> {
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)).catch(() => {});
}
