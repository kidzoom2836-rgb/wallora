/**
 * Daily, contextual in-app promotions.
 *
 * Six slots are available per local calendar day (08:00, 10:30, 13:00,
 * 15:30, 18:00, 21:00). A slot is due once its time has passed, and each
 * promo can be handed out at most once per day. The claim is written before
 * the popup is shown so two callers cannot present the same promo.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { C } from "./theme";

export type PromoIcon =
  | "tv-outline"
  | "image-outline"
  | "musical-notes-outline"
  | "videocam-outline"
  | "people-outline"
  | "color-palette-outline";

export type PromoRoute =
  | "/live-tv"
  | "/(tabs)/discover"
  | "/music"
  | "/video-player"
  | "/community"
  | "/settings";

export type PromoId =
  | "live-tv"
  | "wallpapers"
  | "music"
  | "video"
  | "community"
  | "themes";

export type PromoDefinition = {
  id: PromoId;
  eyebrow: string;
  title: string;
  body: string;
  icon: PromoIcon;
  /** One of the theme color tokens (see ./theme). */
  accent: string;
  route: PromoRoute;
  ctaLabel: string;
  /** Minutes after local midnight when this slot becomes due. */
  slotMinutes: number;
};

/** 08:00, 10:30, 13:00, 15:30, 18:00, 21:00 in local time. */
export const PROMO_SLOT_MINUTES = [480, 630, 780, 930, 1080, 1260] as const;

export const PROMOS: readonly PromoDefinition[] = [
  {
    id: "live-tv",
    eyebrow: "WALLORA LIVE TV",
    title: "There is always something on",
    body: "Jump into live channels, sports and community streams without leaving the app.",
    icon: "tv-outline",
    accent: C.blue,
    route: "/live-tv",
    ctaLabel: "Explore live channels",
    slotMinutes: PROMO_SLOT_MINUTES[0],
  },
  {
    id: "wallpapers",
    eyebrow: "WALLPAPERS",
    title: "A fresh look for your screen",
    body: "Discover curated wallpapers and set your favorite as a live or home screen backdrop.",
    icon: "image-outline",
    accent: C.accent,
    route: "/(tabs)/discover",
    ctaLabel: "Browse wallpapers",
    slotMinutes: PROMO_SLOT_MINUTES[1],
  },
  {
    id: "music",
    eyebrow: "WALLORA MUSIC",
    title: "Your soundtrack is waiting",
    body: "Build a queue, save tracks and keep the music playing while you explore WALLORA.",
    icon: "musical-notes-outline",
    accent: C.supreme,
    route: "/music",
    ctaLabel: "Open music player",
    slotMinutes: PROMO_SLOT_MINUTES[2],
  },
  {
    id: "video",
    eyebrow: "VIDEO PLAYER",
    title: "Watch in fullscreen or PiP",
    body: "Add a video and keep watching in picture-in-picture while you browse the app.",
    icon: "videocam-outline",
    accent: C.success,
    route: "/video-player",
    ctaLabel: "Open video player",
    slotMinutes: PROMO_SLOT_MINUTES[3],
  },
  {
    id: "community",
    eyebrow: "COMMUNITY",
    title: "Find your people here",
    body: "Share creations, follow creators and join the conversations happening right now.",
    icon: "people-outline",
    accent: C.gold,
    route: "/community",
    ctaLabel: "Visit the community",
    slotMinutes: PROMO_SLOT_MINUTES[4],
  },
  {
    id: "themes",
    eyebrow: "THEMES & SETTINGS",
    title: "Make WALLORA yours",
    body: "Tune notifications, downloads and appearance so the app fits the way you use it.",
    icon: "color-palette-outline",
    accent: C.accentBright,
    route: "/settings",
    ctaLabel: "Personalize settings",
    slotMinutes: PROMO_SLOT_MINUTES[5],
  },
];

const STORAGE_PREFIX = "wallora.promos.shown.v1:";

function dayKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function minutesSinceMidnight(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

async function readShown(day: string): Promise<PromoId[]> {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${day}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is PromoId =>
      PROMOS.some((promo) => promo.id === value),
    );
  } catch {
    return [];
  }
}

async function writeShown(day: string, ids: PromoId[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${STORAGE_PREFIX}${day}`, JSON.stringify(ids));
  } catch {
    // Storage is best-effort: a failed write must never block the UI.
  }
}

/**
 * Returns the first due, unseen promo for the current calendar day and claims
 * it immediately (single-threaded JS + a read-modify-write) so concurrent
 * callers cannot receive the same slot twice.
 */
export async function getDuePromo(
  now: Date = new Date(),
): Promise<PromoDefinition | null> {
  const day = dayKey(now);
  const minutes = minutesSinceMidnight(now);
  const shown = await readShown(day);
  const due = PROMOS.find(
    (promo) => promo.slotMinutes <= minutes && !shown.includes(promo.id),
  );
  if (!due) return null;
  await writeShown(day, [...shown, due.id]);
  return due;
}

/** Idempotent; safe to call from auto-dismiss, Skip and See more. */
export async function markPromoShown(
  id: PromoId,
  now: Date = new Date(),
): Promise<void> {
  const day = dayKey(now);
  const shown = await readShown(day);
  if (shown.includes(id)) return;
  await writeShown(day, [...shown, id]);
}

/**
 * Gives a claimed slot back when it could not be presented (for example the
 * user navigated to /live-tv while the check was resolving).
 */
export async function releasePromo(
  id: PromoId,
  now: Date = new Date(),
): Promise<void> {
  const day = dayKey(now);
  const shown = await readShown(day);
  await writeShown(
    day,
    shown.filter((value) => value !== id),
  );
}

/** Clears all promo history. For development / QA only. */
export async function resetPromosForTesting(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const promoKeys = keys.filter((key) => key.startsWith(STORAGE_PREFIX));
    if (promoKeys.length) await AsyncStorage.multiRemove(promoKeys);
  } catch {
    // Ignore storage failures.
  }
}
