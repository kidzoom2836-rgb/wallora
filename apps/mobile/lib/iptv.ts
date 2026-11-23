/**
 * WALLORA Live TV — M3U playlist loading, parsing and persistence.
 *
 * Default source is the community "mu iptv" playlist on GitHub. Users can
 * replace it with their own M3U URL from the Live TV screen. Everything is
 * cached on device so the channel guide still opens without a connection.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiJson } from "./api";

export type IptvChannel = {
  id: string;
  name: string;
  group: string;
  logo?: string;
  url: string;
  tvgId?: string;
  /** Set by the WALLORA admin panel and returned by the database channel API. */
  isFeatured?: boolean;
  previewUrl?: string;
};

export type PlaylistResult = {
  channels: IptvChannel[];
  source: string;
  sourceLabel: string;
  fetchedAt: number;
  offline: boolean;
};

export const DEFAULT_PLAYLIST_URL =
  "https://raw.githubusercontent.com/nn2wdw5jvc-max/mu-iptv/main/EDEM_2.m3u";

const CACHE_KEY = "wallora.iptv.playlist.v2";
const DB_SOURCE = "wallora.database.channels";
const CUSTOM_URL_KEY = "wallora.iptv.customUrl.v1";
const FAVORITES_KEY = "wallora.iptv.favorites.v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** Safe, public demo streams used when the community playlist is unavailable. */
export const FALLBACK_CHANNELS: IptvChannel[] = [
  {
    id: "demo-big-buck-bunny",
    name: "WALLORA Demo · Big Buck Bunny",
    group: "Demo",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    tvgId: "wallora-demo-1",
  },
  {
    id: "demo-tears-of-steel",
    name: "WALLORA Demo · Tears of Steel",
    group: "Demo",
    url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    tvgId: "wallora-demo-2",
  },
  {
    id: "demo-angel-one",
    name: "WALLORA Demo · Angel One",
    group: "Demo",
    url: "https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8",
    tvgId: "wallora-demo-3",
  },
  {
    id: "demo-pts-shift",
    name: "WALLORA Demo · Live Shift",
    group: "Demo",
    url: "https://test-streams.mux.dev/pts_shift/master.m3u8",
    tvgId: "wallora-demo-4",
  },
];

const GROUP_LABELS: Record<string, string> = {
  общие: "General",
  фильмы: "Movies",
  сериалы: "Series",
  спорт: "Sports",
  детские: "Kids",
  музыка: "Music",
  новости: "News",
  развлекательные: "Entertainment",
  познавательные: "Documentary",
  региональные: "Regional",
  зарубежные: "International",
  "все каналы": "All channels",
};

export function groupLabel(group: string): string {
  return GROUP_LABELS[group.trim().toLowerCase()] ?? group;
}

function attrsOf(line: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line))) attrs[match[1].toLowerCase()] = match[2];
  return attrs;
}

function httpsLogo(logo?: string): string | undefined {
  if (!logo) return undefined;
  // Cleartext images are blocked on modern Android; the host supports TLS.
  return logo.replace(/^http:\/\//i, "https://") || undefined;
}

/** Parse a standard M3U / M3U8 playlist into a channel list. */
export function parsePlaylist(text: string): IptvChannel[] {
  const lines = text.split(/\r?\n/);
  const channels: IptvChannel[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXTINF")) continue;

    let url = "";
    for (let j = i + 1; j < lines.length && j < i + 6; j += 1) {
      const candidate = lines[j].trim();
      if (!candidate) continue;
      if (candidate.startsWith("#")) break;
      url = candidate;
      break;
    }
    if (!/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;

    const comma = line.lastIndexOf(",");
    const attrs = attrsOf(line.slice(0, comma));
    const name =
      (comma >= 0 ? line.slice(comma + 1) : line).trim() || "Unknown channel";
    const group = attrs["group-title"]?.trim() || "Other";

    seen.add(url);
    channels.push({
      id: attrs["tvg-id"] || `${BufferSafeHash(url)}-${channels.length}`,
      name,
      group,
      logo: httpsLogo(attrs["tvg-logo"]),
      url,
      tvgId: attrs["tvg-id"],
    });
  }

  return channels;
}

/** Tiny non-crypto hash — only used to create stable ids for unnamed channels. */
function BufferSafeHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function uniqueChannelId(channel: IptvChannel): string {
  return `${channel.group}-${channel.name}-${channel.url}`.slice(0, 160);
}

async function fetchWithTimeout(url: string, ms = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/plain" },
    });
  } finally {
    clearTimeout(timer);
  }
}

function fallbackResult(
  url: string,
  offline: boolean,
  fetchedAt = Date.now(),
): PlaylistResult {
  return {
    channels: FALLBACK_CHANNELS,
    source: url,
    sourceLabel: "WALLORA demo channels",
    fetchedAt,
    offline,
  };
}

/** Load channels from the configured playlist, with cached/offline fallbacks. */
export async function loadPlaylist(options?: {
  force?: boolean;
}): Promise<PlaylistResult> {
  const customUrl = await getCustomPlaylistUrl().catch(() => null);
  const url = customUrl || DEFAULT_PLAYLIST_URL;
  // The backend is the default source of truth; a user-supplied M3U overrides it.
  const cacheSource = customUrl ? url : DB_SOURCE;

  let cached: PlaylistResult | null = null;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlaylistResult;
      if (parsed?.source === cacheSource) cached = parsed;
    }
  } catch {
    cached = null;
  }

  if (
    cached &&
    !options?.force &&
    cached.channels?.length &&
    Date.now() - cached.fetchedAt < CACHE_TTL_MS
  ) {
    return { ...cached, offline: false };
  }

  if (!customUrl) {
    try {
      const backend = await apiJson<{ items?: IptvChannel[] }>(
        "/api/v1/channels?limit=500",
      );
      const channels = (backend?.items ?? [])
        .filter(
          (channel) =>
            channel &&
            typeof channel.id === "string" &&
            typeof channel.name === "string" &&
            typeof channel.url === "string" &&
            /^https?:\/\//i.test(channel.url),
        )
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
          group: channel.group || "Other",
          logo: channel.logo,
          url: channel.url,
          tvgId: channel.tvgId,
          isFeatured: channel.isFeatured,
          previewUrl: channel.previewUrl,
        }));
      if (channels.length >= 3) {
        const result: PlaylistResult = {
          channels,
          source: DB_SOURCE,
          sourceLabel: "WALLORA TV · database",
          fetchedAt: Date.now(),
          offline: false,
        };
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(result)).catch(
          () => {},
        );
        return result;
      }
    } catch {
      // Fall through to the community M3U playlist when the backend is down.
    }
  }

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok)
      throw new Error(`Playlist request failed (${response.status})`);
    const channels = parsePlaylist(await response.text());
    if (channels.length < 3)
      throw new Error("Playlist has no playable channels");

    const result: PlaylistResult = {
      channels,
      source: cacheSource,
      sourceLabel: customUrl ? "Your playlist" : "Community playlist",
      fetchedAt: Date.now(),
      offline: false,
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(result)).catch(
      () => {},
    );
    return result;
  } catch {
    if (cached?.channels?.length) return { ...cached, offline: true };
    return fallbackResult(url, true);
  }
}

export async function getCustomPlaylistUrl(): Promise<string | null> {
  const url = await AsyncStorage.getItem(CUSTOM_URL_KEY);
  return url?.trim() || null;
}

export async function setCustomPlaylistUrl(url: string | null): Promise<void> {
  if (url?.trim()) await AsyncStorage.setItem(CUSTOM_URL_KEY, url.trim());
  else await AsyncStorage.removeItem(CUSTOM_URL_KEY);
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
}

export async function getFavoriteChannelIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export async function toggleFavoriteChannel(id: string): Promise<string[]> {
  const current = await getFavoriteChannelIds();
  const next = current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id];
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next)).catch(
    () => {},
  );
  return next;
}
