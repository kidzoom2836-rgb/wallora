/**
 * Browse helpers for the Netflix-style WALLORA TV guide.
 *
 * Collections are derived on-device from the loaded playlist and the existing
 * local analytics, so they work with the backend guide, a custom M3U URL or
 * the bundled iptv-org fallback.
 */

import { groupLabel, uniqueChannelId, type IptvChannel } from "./iptv";

export type CollectionType =
  | "recommended"
  | "featured"
  | "watched"
  | "trending"
  | "favorites"
  | "all"
  | "group"
  | "country"
  | "genre"
  | "search";

export const COLLECTION_META: Record<
  CollectionType,
  { title: string; subtitle: string; icon: string }
> = {
  recommended: {
    title: "Recommended for you",
    subtitle: "Ranked from your favorites, watches and community likes",
    icon: "sparkles-outline",
  },
  featured: {
    title: "Featured on WALLORA",
    subtitle: "Admin-recommended channels",
    icon: "star-outline",
  },
  watched: {
    title: "Most watched by you",
    subtitle: "Your personal top channels",
    icon: "eye-outline",
  },
  trending: {
    title: "Trending in WALLORA",
    subtitle: "Popular with the community right now",
    icon: "flame-outline",
  },
  favorites: {
    title: "Your favorites",
    subtitle: "Saved for quick access",
    icon: "heart-outline",
  },
  all: {
    title: "All channels",
    subtitle: "Every channel in the current guide",
    icon: "grid-outline",
  },
  group: { title: "Category", subtitle: "", icon: "pricetags-outline" },
  country: { title: "Country", subtitle: "", icon: "earth-outline" },
  genre: { title: "Genre", subtitle: "", icon: "film-outline" },
  search: { title: "Search results", subtitle: "", icon: "search-outline" },
};

const COUNTRY_NAMES: Record<string, string> = {
  ke: "Kenya",
  ug: "Uganda",
  tz: "Tanzania",
  rw: "Rwanda",
  et: "Ethiopia",
  ng: "Nigeria",
  gh: "Ghana",
  za: "South Africa",
  eg: "Egypt",
  ma: "Morocco",
  us: "United States",
  gb: "United Kingdom",
  ca: "Canada",
  de: "Germany",
  fr: "France",
  es: "Spain",
  it: "Italy",
  nl: "Netherlands",
  ae: "United Arab Emirates",
  sa: "Saudi Arabia",
  in: "India",
  pk: "Pakistan",
  bd: "Bangladesh",
  au: "Australia",
  br: "Brazil",
  mx: "Mexico",
};

const COUNTRY_HINTS = [
  "Kenya",
  "Uganda",
  "Tanzania",
  "Nigeria",
  "South Africa",
  "United States",
  "United Kingdom",
  "India",
];

/** Best-effort country label from tvg-id, group or channel name. */
export function channelCountry(channel: IptvChannel): string | null {
  const tvg = channel.tvgId?.trim().toLowerCase() ?? "";
  const prefix = tvg.split(/[.:_-]/)[0];
  if (prefix && COUNTRY_NAMES[prefix]) return COUNTRY_NAMES[prefix];

  const haystack = `${groupLabel(channel.group)} ${channel.name}`;
  for (const name of COUNTRY_HINTS) {
    if (haystack.toLowerCase().includes(name.toLowerCase())) return name;
  }
  return null;
}

export function channelGenre(channel: IptvChannel): string {
  return groupLabel(channel.group) || "Other";
}

export function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => !!value && !!value.trim())),
  ).sort((a, b) => a.localeCompare(b));
}

export function buildBrowseMaps(channels: IptvChannel[]) {
  const groups = uniqueSorted(channels.map(channelGenre));
  const countries = uniqueSorted(channels.map(channelCountry));
  const genres = uniqueSorted(
    channels.flatMap((channel) => {
      const genre = channelGenre(channel);
      return genre === "Other" ? [] : [genre];
    }),
  );
  return { groups, countries, genres };
}

export function byId(channels: IptvChannel[], ids: Set<string>): IptvChannel[] {
  return channels.filter((channel) => ids.has(uniqueChannelId(channel)));
}

export function dedupeChannels(channels: IptvChannel[]): IptvChannel[] {
  const seen = new Set<string>();
  return channels.filter((channel) => {
    const id = uniqueChannelId(channel);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function sortChannels(
  channels: IptvChannel[],
  mode: "recommended" | "az" | "group",
): IptvChannel[] {
  if (mode === "az") {
    return [...channels].sort((a, b) => a.name.localeCompare(b.name));
  }
  if (mode === "group") {
    return [...channels].sort(
      (a, b) =>
        channelGenre(a).localeCompare(channelGenre(b)) ||
        a.name.localeCompare(b.name),
    );
  }
  return channels;
}

/** Local, editable program-title suggestion used by the AI mark tool. */
export function suggestProgramTitle(channel: IptvChannel, at = new Date()): string {
  const hour = at.getHours();
  const part = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  const group = channelGenre(channel).toLowerCase();

  if (/kids|children|cartoon/.test(group)) return `${part} Kids Club`;
  if (/sport/.test(group)) return `${part} Sports Live`;
  if (/news/.test(group)) return `${part} News Bulletin`;
  if (/movie|film|cinema/.test(group)) return `${part} Movie Night`;
  if (/music/.test(group)) return `${part} Music Mix`;
  return `${channel.name} · ${part} Show`;
}

/** Next local date for a HH:MM program time, never in the past. */
export function nextTimeAt(hour: number, minute: number, from = new Date()): Date {
  const next = new Date(from);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

/** Parse "18:30" safely, returning null for invalid input. */
export function parseClock(value: string): { hour: number; minute: number } | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}
