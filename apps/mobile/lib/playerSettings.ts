import AsyncStorage from "@react-native-async-storage/async-storage";

export type PlayerAspectRatio = "fit" | "fill" | "stretch";

export type PlayerSettings = {
  /** TikTok-style vertical channel zapping. */
  zappingEnabled: boolean;
  /** Ignore all touch gestures while handing the phone to someone else. */
  touchLocked: boolean;
  /** Keep audio playing and hide the video surface. */
  audioOnly: boolean;
  /** Dim the picture for low-light viewing without changing system brightness. */
  nightMode: boolean;
  aspectRatio: PlayerAspectRatio;
  brightness: number;
  volume: number;
};

const PLAYER_SETTINGS_KEY = "wallora.tv.playerSettings.v1";

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  zappingEnabled: false,
  touchLocked: false,
  audioOnly: false,
  nightMode: false,
  aspectRatio: "fit",
  brightness: 0.85,
  volume: 1,
};

export const ASPECT_RATIO_LABELS: Record<PlayerAspectRatio, string> = {
  fit: "Fit",
  fill: "Fill",
  stretch: "Stretch",
};

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function unit(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

export async function getPlayerSettings(): Promise<PlayerSettings> {
  try {
    const raw = await AsyncStorage.getItem(PLAYER_SETTINGS_KEY);
    if (!raw) return DEFAULT_PLAYER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PlayerSettings>;
    const ratio =
      parsed.aspectRatio === "fill" || parsed.aspectRatio === "stretch"
        ? parsed.aspectRatio
        : "fit";
    return {
      zappingEnabled: bool(parsed.zappingEnabled, DEFAULT_PLAYER_SETTINGS.zappingEnabled),
      touchLocked: bool(parsed.touchLocked, DEFAULT_PLAYER_SETTINGS.touchLocked),
      audioOnly: bool(parsed.audioOnly, DEFAULT_PLAYER_SETTINGS.audioOnly),
      nightMode: bool(parsed.nightMode, DEFAULT_PLAYER_SETTINGS.nightMode),
      aspectRatio: ratio,
      brightness: unit(parsed.brightness, DEFAULT_PLAYER_SETTINGS.brightness),
      volume: unit(parsed.volume, DEFAULT_PLAYER_SETTINGS.volume),
    };
  } catch {
    return DEFAULT_PLAYER_SETTINGS;
  }
}

export async function savePlayerSettings(
  patch: Partial<PlayerSettings>,
): Promise<PlayerSettings> {
  const current = await getPlayerSettings();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(PLAYER_SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
  return next;
}
