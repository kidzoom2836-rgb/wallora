import AsyncStorage from "@react-native-async-storage/async-storage";

export type TvQuality = "auto" | "480p" | "720p" | "1080p";

export type TvSettings = {
  quality: TvQuality;
  lowDataMode: boolean;
  autoplay: boolean;
  showWatermark: boolean;
  subtitlesDefault: boolean;
};

const SETTINGS_KEY = "wallora.tv.settings.v1";

export const DEFAULT_TV_SETTINGS: TvSettings = {
  quality: "auto",
  lowDataMode: false,
  autoplay: true,
  showWatermark: true,
  subtitlesDefault: false,
};

export const QUALITY_OPTIONS: { value: TvQuality; label: string; detail: string }[] = [
  { value: "auto", label: "Auto", detail: "Best stream the channel can provide" },
  { value: "480p", label: "480p", detail: "Data saver — stable around 1 Mbps" },
  { value: "720p", label: "720p", detail: "Balanced quality and buffering" },
  { value: "1080p", label: "1080p", detail: "Highest quality when bandwidth allows" },
];

export function qualityHeight(quality: TvQuality): number | null {
  if (quality === "480p") return 480;
  if (quality === "720p") return 720;
  if (quality === "1080p") return 1080;
  return null;
}

export async function getTvSettings(): Promise<TvSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_TV_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<TvSettings>;
    return {
      quality: QUALITY_OPTIONS.some((option) => option.value === parsed.quality)
        ? (parsed.quality as TvQuality)
        : DEFAULT_TV_SETTINGS.quality,
      lowDataMode: typeof parsed.lowDataMode === "boolean" ? parsed.lowDataMode : false,
      autoplay: typeof parsed.autoplay === "boolean" ? parsed.autoplay : true,
      showWatermark:
        typeof parsed.showWatermark === "boolean" ? parsed.showWatermark : true,
      subtitlesDefault:
        typeof parsed.subtitlesDefault === "boolean" ? parsed.subtitlesDefault : false,
    };
  } catch {
    return DEFAULT_TV_SETTINGS;
  }
}

export async function saveTvSettings(patch: Partial<TvSettings>): Promise<TvSettings> {
  const current = await getTvSettings();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
  return next;
}
