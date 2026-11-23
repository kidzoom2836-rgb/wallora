import AsyncStorage from "@react-native-async-storage/async-storage";

export type TvQuality = "auto" | "480p" | "720p" | "1080p";
export type TvGuideSort = "recommended" | "az" | "group";

export type TvSettings = {
  quality: TvQuality;
  lowDataMode: boolean;
  autoplay: boolean;
  showWatermark: boolean;
  subtitlesDefault: boolean;
  autoReconnect: boolean;
  backgroundAudio: boolean;
  defaultSpeed: number;
  hideGeoBlocked: boolean;
  hideNot24x7: boolean;
  httpsOnly: boolean;
  guideSort: TvGuideSort;
};

const SETTINGS_KEY = "wallora.tv.settings.v1";

export const SPEED_OPTIONS = [1, 1.25, 1.5, 2] as const;

export const DEFAULT_TV_SETTINGS: TvSettings = {
  quality: "auto",
  lowDataMode: false,
  autoplay: true,
  showWatermark: true,
  subtitlesDefault: false,
  autoReconnect: true,
  backgroundAudio: true,
  defaultSpeed: 1,
  hideGeoBlocked: false,
  hideNot24x7: false,
  httpsOnly: false,
  guideSort: "recommended",
};

export const QUALITY_OPTIONS: { value: TvQuality; label: string; detail: string }[] = [
  { value: "auto", label: "Auto", detail: "Best stream the channel can provide" },
  { value: "480p", label: "480p", detail: "Data saver — stable around 1 Mbps" },
  { value: "720p", label: "720p", detail: "Balanced quality and buffering" },
  { value: "1080p", label: "1080p", detail: "Highest quality when bandwidth allows" },
];

export const SORT_OPTIONS: { value: TvGuideSort; label: string; detail: string }[] = [
  { value: "recommended", label: "Recommended", detail: "WALLORA ranking and favorites first" },
  { value: "az", label: "A–Z", detail: "Alphabetical by channel name" },
  { value: "group", label: "By group", detail: "Grouped by category, then A–Z" },
];

export function qualityHeight(quality: TvQuality): number | null {
  if (quality === "480p") return 480;
  if (quality === "720p") return 720;
  if (quality === "1080p") return 1080;
  return null;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
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
      lowDataMode: bool(parsed.lowDataMode, DEFAULT_TV_SETTINGS.lowDataMode),
      autoplay: bool(parsed.autoplay, DEFAULT_TV_SETTINGS.autoplay),
      showWatermark: bool(parsed.showWatermark, DEFAULT_TV_SETTINGS.showWatermark),
      subtitlesDefault: bool(
        parsed.subtitlesDefault,
        DEFAULT_TV_SETTINGS.subtitlesDefault,
      ),
      autoReconnect: bool(parsed.autoReconnect, DEFAULT_TV_SETTINGS.autoReconnect),
      backgroundAudio: bool(
        parsed.backgroundAudio,
        DEFAULT_TV_SETTINGS.backgroundAudio,
      ),
      defaultSpeed:
        typeof parsed.defaultSpeed === "number" &&
        Number.isFinite(parsed.defaultSpeed) &&
        parsed.defaultSpeed >= 0.5 &&
        parsed.defaultSpeed <= 2
          ? parsed.defaultSpeed
          : DEFAULT_TV_SETTINGS.defaultSpeed,
      hideGeoBlocked: bool(
        parsed.hideGeoBlocked,
        DEFAULT_TV_SETTINGS.hideGeoBlocked,
      ),
      hideNot24x7: bool(parsed.hideNot24x7, DEFAULT_TV_SETTINGS.hideNot24x7),
      httpsOnly: bool(parsed.httpsOnly, DEFAULT_TV_SETTINGS.httpsOnly),
      guideSort: SORT_OPTIONS.some((option) => option.value === parsed.guideSort)
        ? (parsed.guideSort as TvGuideSort)
        : DEFAULT_TV_SETTINGS.guideSort,
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
