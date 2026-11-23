import AsyncStorage from "@react-native-async-storage/async-storage";

export type VideoSettings = {
  speed: number;
  quality: "auto" | "480p" | "720p" | "1080p";
  subtitlesEnabled: boolean;
  showWatermark: boolean;
  loop: boolean;
  sleepMinutes: number | null;
  autoplay: boolean;
};

const SETTINGS_KEY = "wallora.video.settings.v1";

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  speed: 1,
  quality: "auto",
  subtitlesEnabled: false,
  showWatermark: true,
  loop: false,
  sleepMinutes: null,
  autoplay: true,
};

export const VIDEO_SPEEDS = [0.75, 1, 1.25, 1.5, 2];
export const VIDEO_SLEEP_OPTIONS = [5, 10, 30];

export function videoQualityHeight(quality: VideoSettings["quality"]): number | null {
  if (quality === "480p") return 480;
  if (quality === "720p") return 720;
  if (quality === "1080p") return 1080;
  return null;
}

export async function getVideoSettings(): Promise<VideoSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_VIDEO_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<VideoSettings>;
    return {
      speed: VIDEO_SPEEDS.includes(parsed.speed as number)
        ? (parsed.speed as number)
        : DEFAULT_VIDEO_SETTINGS.speed,
      quality: ["auto", "480p", "720p", "1080p"].includes(parsed.quality as string)
        ? (parsed.quality as VideoSettings["quality"])
        : DEFAULT_VIDEO_SETTINGS.quality,
      subtitlesEnabled:
        typeof parsed.subtitlesEnabled === "boolean"
          ? parsed.subtitlesEnabled
          : false,
      showWatermark:
        typeof parsed.showWatermark === "boolean" ? parsed.showWatermark : true,
      loop: typeof parsed.loop === "boolean" ? parsed.loop : false,
      sleepMinutes:
        typeof parsed.sleepMinutes === "number" ? parsed.sleepMinutes : null,
      autoplay: typeof parsed.autoplay === "boolean" ? parsed.autoplay : true,
    };
  } catch {
    return DEFAULT_VIDEO_SETTINGS;
  }
}

export async function saveVideoSettings(
  patch: Partial<VideoSettings>,
): Promise<VideoSettings> {
  const current = await getVideoSettings();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
  return next;
}
