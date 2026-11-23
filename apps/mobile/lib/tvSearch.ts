/**
 * YouTube-like channel finder for WALLORA Live TV.
 *
 * The guide can contain thousands of channels, so matching is done locally and
 * ranked: exact names win, then prefixes, then typo-tolerant and initialism
 * matches. No search text leaves the device.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { groupLabel, type IptvChannel } from "./iptv";

export const TV_SEARCH_RECENT_KEY = "wallora.tv.searchRecent.v1";

export type ChannelMatch = { channel: IptvChannel; score: number };

/** Common abbreviations people type instead of the full station name. */
const TOKEN_ALIASES: Record<string, string[]> = {
  citzen: ["citizen"],
  citizen: ["citizen"],
  ktv: ["ktv"],
  ktn: ["ktn", "kenya", "television", "network"],
  ntv: ["ntv", "nation", "television"],
  k24: ["k24"],
  jubi: ["jubilee"],
  switch: ["switch"],
};

export async function clearRecentTvSearches(): Promise<void> {
  await AsyncStorage.removeItem(TV_SEARCH_RECENT_KEY).catch(() => {});
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Bounded Levenshtein distance; returns max + 1 as soon as it cannot match. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

function scoreToken(token: string, words: string[], field: string): number {
  let best = 0;
  for (const word of words) {
    if (!word) continue;
    if (word === token) {
      best = Math.max(best, 100);
    } else if (word.startsWith(token)) {
      best = Math.max(best, 82 - Math.min(10, word.length - token.length));
    } else if (word.includes(token)) {
      best = Math.max(best, 62);
    } else if (token.length >= 4) {
      // Two edits catches common transpositions such as "sprots" → "sports".
      const maxDistance = token.length >= 5 ? 2 : 1;
      const distance = editDistance(token, word, maxDistance);
      if (distance <= maxDistance) best = Math.max(best, 58 - distance * 14);
    }
  }

  if (best < 60 && token.length >= 2 && words.length > 1) {
    const initials = words.map((word) => word[0]).join("");
    if (initials.startsWith(token)) best = Math.max(best, 72);
    else if (initials.includes(token)) best = Math.max(best, 58);
  }

  if (best === 0 && field.includes(token)) best = 40;
  return best;
}

const fieldsCache = new WeakMap<IptvChannel, string[]>();

function fieldsOf(channel: IptvChannel): string[] {
  const cached = fieldsCache.get(channel);
  if (cached) return cached;
  const fields = [
    normalize(channel.name),
    normalize(groupLabel(channel.group)),
    normalize(channel.tvgId ?? ""),
  ].filter(Boolean);
  fieldsCache.set(channel, fields);
  return fields;
}

function expandedToken(token: string): string[] {
  return [token, ...(TOKEN_ALIASES[token] ?? [])];
}

/** True when the query already appears literally in a channel name or group. */
export function hasExactChannelText(
  channels: IptvChannel[],
  query: string,
): boolean {
  const needle = normalize(query);
  if (!needle) return true;
  return channels.some((channel) => {
    const fields = fieldsOf(channel);
    return fields.some((field) => field.includes(needle));
  });
}

/** Rank channels by how well they match a partial, abbreviated or misspelled query. */
export function findChannelMatches(
  channels: IptvChannel[],
  query: string,
  limit = 6,
): ChannelMatch[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const matches: ChannelMatch[] = [];

  for (const channel of channels) {
    const fields = fieldsOf(channel);
    if (!fields.length) continue;

    let score = 0;
    let matchedAll = true;
    for (const token of tokens) {
      let best = 0;
      for (const field of fields) {
        const words = field.split(" ").filter(Boolean);
        for (const option of expandedToken(token)) {
          best = Math.max(best, scoreToken(option, words, field));
        }
      }
      if (best <= 0) {
        matchedAll = false;
        break;
      }
      score += best;
    }
    if (!matchedAll) continue;

    const fullText = fields.join(" ");
    const name = fields[0];
    if (fullText.includes(normalizedQuery)) score += 60;
    if (name.startsWith(normalizedQuery)) score += 24;
    if (name.split(" ").some((word) => word.startsWith(normalizedQuery))) score += 14;
    if (name === normalizedQuery) score += 40;

    matches.push({ channel, score });
  }

  matches.sort(
    (a, b) => b.score - a.score || a.channel.name.localeCompare(b.channel.name),
  );
  return matches.slice(0, limit);
}
