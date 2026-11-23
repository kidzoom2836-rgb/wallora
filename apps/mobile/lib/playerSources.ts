import AsyncStorage from "@react-native-async-storage/async-storage";

import type { IptvChannel } from "./iptv";

const BACKUP_URLS_KEY = "wallora.tv.backupUrls.v1";
const MAX_BACKUPS_PER_CHANNEL = 6;

export type SourceVariant = {
  id: string;
  label: string;
  detail: string;
  url: string;
  kind: "primary" | "backup" | "retry";
};

function isSafeStreamUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      !!parsed.hostname
    );
  } catch {
    return false;
  }
}

function readMap(raw: string | null): Record<string, string[]> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      result[key] = value
        .filter((item): item is string => typeof item === "string" && isSafeStreamUrl(item))
        .slice(0, MAX_BACKUPS_PER_CHANNEL);
    }
    return result;
  } catch {
    return {};
  }
}

async function loadAll(): Promise<Record<string, string[]>> {
  try {
    return readMap(await AsyncStorage.getItem(BACKUP_URLS_KEY));
  } catch {
    return {};
  }
}

export async function getBackupUrls(channelId: string): Promise<string[]> {
  const all = await loadAll();
  return all[channelId] ?? [];
}

export async function addBackupUrl(
  channelId: string,
  url: string,
): Promise<string[]> {
  const trimmed = url.trim();
  if (!isSafeStreamUrl(trimmed)) {
    throw new Error("Enter a public http(s) stream URL.");
  }
  const all = await loadAll();
  const existing = all[channelId] ?? [];
  if (existing.includes(trimmed)) return existing;
  const next = [trimmed, ...existing].slice(0, MAX_BACKUPS_PER_CHANNEL);
  all[channelId] = next;
  await AsyncStorage.setItem(BACKUP_URLS_KEY, JSON.stringify(all)).catch(() => {});
  return next;
}

function withQuery(url: string, key: string, value: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${key}=${encodeURIComponent(value)}`;
}

/**
 * Source list shown in the in-player Server switcher. The primary and user
 * submitted backups are real URLs. The retry variants re-request the same URL
 * with a cache-busting key, which clears many stale CDN/edge responses.
 */
export function buildSourceVariants(
  channel: IptvChannel | null,
  backups: string[],
): SourceVariant[] {
  if (!channel) return [];
  const variants: SourceVariant[] = [
    {
      id: "primary",
      label: "Server 1 · Primary",
      detail: "The channel's default stream",
      url: channel.url,
      kind: "primary",
    },
  ];

  backups.forEach((url, index) => {
    variants.push({
      id: `backup-${index + 1}`,
      label: `Server ${variants.length + 1} · Backup`,
      detail: "Community suggested URL stored on this device",
      url,
      kind: "backup",
    });
  });

  [2, 3].forEach((number) => {
    variants.push({
      id: `retry-${number}`,
      label: `Server ${variants.length + 1} · Freshen`,
      detail: "Same source with a fresh cache key",
      url: withQuery(channel.url, "_wallora_server", String(number)),
      kind: "retry",
    });
  });

  return variants;
}
