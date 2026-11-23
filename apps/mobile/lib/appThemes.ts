/**
 * Switchable WALLORA app themes.
 *
 * The screens use the shared color object from lib/theme.ts. A theme is applied
 * before the navigator module is loaded (see components/theme/ThemeGate.tsx),
 * so every StyleSheet created at module scope picks up the selected palette.
 * Changing theme persists the choice and reloads the JS bundle once.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { reloadAppAsync } from "expo";

import { BASE_COLORS, C, type ThemeColors } from "./theme";

export const APP_THEME_STORAGE_KEY = "wallora.app.theme.v1";

export type AppThemeId = "midnight" | "ocean" | "aurora" | "emerald" | "rose";

export type AppTheme = {
  id: AppThemeId;
  label: string;
  tagline: string;
  swatches: [string, string, string];
  colors: ThemeColors;
};

function rgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const int = Number.parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function palette(overrides: Partial<ThemeColors>): ThemeColors {
  const accent = overrides.accent ?? BASE_COLORS.accent;
  const success = overrides.success ?? BASE_COLORS.success;
  const error = overrides.error ?? BASE_COLORS.error;
  const blue = overrides.blue ?? BASE_COLORS.blue;
  const supreme = overrides.supreme ?? BASE_COLORS.supreme;

  return {
    ...BASE_COLORS,
    ...overrides,
    accent,
    accentBright: overrides.accentBright ?? accent,
    accentDim: overrides.accentDim ?? rgba(accent, 0.14),
    success,
    successDim: overrides.successDim ?? rgba(success, 0.14),
    error,
    errorDim: overrides.errorDim ?? rgba(error, 0.14),
    blue,
    blueDim: overrides.blueDim ?? rgba(blue, 0.14),
    gold: overrides.gold ?? accent,
    goldDim: overrides.goldDim ?? rgba(accent, 0.14),
    supreme,
    supremeDim: overrides.supremeDim ?? rgba(supreme, 0.14),
  };
}

export const APP_THEMES: AppTheme[] = [
  {
    id: "midnight",
    label: "Midnight Gold",
    tagline: "The signature WALLORA look",
    swatches: ["#0B0C0F", "#14161B", "#D7B879"],
    colors: palette({}),
  },
  {
    id: "ocean",
    label: "Ocean Blue",
    tagline: "Cool, calm and cinematic",
    swatches: ["#06121D", "#102333", "#54B9E8"],
    colors: palette({
      bg: "#06121D",
      bgDeep: "#030A10",
      bgElevated: "#0A1927",
      card: "#0E2131",
      raised: "#162C3F",
      raisedHover: "#1E3A50",
      text: "#F2F9FF",
      textSoft: "#C4D6E5",
      muted: "#8CA5B9",
      mutedDark: "#5A7183",
      border: "#1E3A50",
      borderSoft: "#152B3C",
      accent: "#54B9E8",
      accentBright: "#A8E6FF",
      blue: "#54B9E8",
    }),
  },
  {
    id: "aurora",
    label: "Aurora Violet",
    tagline: "Bold purple with a neon edge",
    swatches: ["#0C0817", "#1A1230", "#B98CFF"],
    colors: palette({
      bg: "#0C0817",
      bgDeep: "#060410",
      bgElevated: "#130E23",
      card: "#1A1230",
      raised: "#251A40",
      raisedHover: "#322350",
      text: "#FAF7FF",
      textSoft: "#D3C9E8",
      muted: "#9A8DB6",
      mutedDark: "#675C7E",
      border: "#302549",
      borderSoft: "#221938",
      accent: "#B98CFF",
      accentBright: "#DCC4FF",
      supreme: "#B98CFF",
    }),
  },
  {
    id: "emerald",
    label: "Emerald Night",
    tagline: "Fresh green, easy on the eyes",
    swatches: ["#06130F", "#10281F", "#43D6A0"],
    colors: palette({
      bg: "#06130F",
      bgDeep: "#030B08",
      bgElevated: "#0A1F17",
      card: "#10281F",
      raised: "#17382B",
      raisedHover: "#204A38",
      text: "#F2FBF7",
      textSoft: "#C3DBD0",
      muted: "#88A699",
      mutedDark: "#587166",
      border: "#1D4031",
      borderSoft: "#142E24",
      accent: "#43D6A0",
      accentBright: "#A7F3D0",
      success: "#43D6A0",
    }),
  },
  {
    id: "rose",
    label: "Rose Sunset",
    tagline: "Warm pink and amber accents",
    swatches: ["#160A11", "#2B1420", "#FF8FA8"],
    colors: palette({
      bg: "#160A11",
      bgDeep: "#0D060A",
      bgElevated: "#20101A",
      card: "#2B1420",
      raised: "#3B1D2D",
      raisedHover: "#4C273A",
      text: "#FFF6F8",
      textSoft: "#E7CBD4",
      muted: "#B394A1",
      mutedDark: "#7A5A68",
      border: "#442333",
      borderSoft: "#321926",
      accent: "#FF8FA8",
      accentBright: "#FFC2D0",
      error: "#FF8FA8",
    }),
  },
];

let activeThemeId: AppThemeId = "midnight";

export function getTheme(id?: string | null): AppTheme {
  return APP_THEMES.find((theme) => theme.id === id) ?? APP_THEMES[0];
}

export function getActiveThemeId(): AppThemeId {
  return activeThemeId;
}

export function getActiveTheme(): AppTheme {
  return getTheme(activeThemeId);
}

export function isAppThemeId(value: string): value is AppThemeId {
  return APP_THEMES.some((theme) => theme.id === value);
}

/** Mutate the shared palette used by every screen's StyleSheet. */
export function applyAppTheme(id?: string | null): AppTheme {
  const theme = getTheme(id);
  Object.assign(C, theme.colors);
  activeThemeId = theme.id;
  return theme;
}

/** Load the persisted theme at startup, before any screen module is imported. */
export async function hydrateAppTheme(): Promise<AppTheme> {
  try {
    const stored = await AsyncStorage.getItem(APP_THEME_STORAGE_KEY);
    return applyAppTheme(stored);
  } catch {
    return applyAppTheme("midnight");
  }
}

/**
 * Persist a theme and reload the JS bundle so module-level styles are rebuilt.
 * Returns false when the selection did not change.
 */
export async function selectAppTheme(id: AppThemeId): Promise<boolean> {
  const theme = getTheme(id);
  if (theme.id === activeThemeId) return false;

  try {
    await AsyncStorage.setItem(APP_THEME_STORAGE_KEY, theme.id);
  } catch {
    // Still apply for this session even when persistence fails.
  }
  applyAppTheme(theme.id);

  try {
    await reloadAppAsync("WALLORA theme changed");
  } catch {
    // Some dev environments (notably Expo Go) may refuse a programmatic
    // reload. The palette is applied in memory and will persist on next launch.
  }
  return true;
}
