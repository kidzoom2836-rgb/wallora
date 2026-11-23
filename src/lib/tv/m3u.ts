/** Minimal M3U/M3U8 parser for server-side WALLORA TV playlist sync. */

export type ParsedChannel = {
  slug: string;
  name: string;
  groupName: string;
  logoUrl: string | null;
  streamUrl: string;
};

function attribute(line: string, key: string): string | null {
  const match = line.match(new RegExp(`${key}="([^"]*)"`, "i"));
  return match?.[1]?.trim() || null;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/** Parse EXTINF-tagged channels from an M3U playlist. */
// iptv-org's full index currently has ~11.5k channels; keep the ceiling above
// that so a full sync is not silently truncated.
export function parseM3U(text: string, max = 20000): ParsedChannel[] {
  const lines = text.split(/\r?\n/);
  const channels: ParsedChannel[] = [];
  let pending: { name: string; groupName: string; logoUrl: string | null } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF:")) {
      const tail = line.slice(line.indexOf(",") + 1).trim();
      const name = attribute(line, "tvg-name") || tail || "Unknown channel";
      pending = {
        name: name.slice(0, 180),
        groupName: (attribute(line, "group-title") || "General").slice(0, 120),
        logoUrl: attribute(line, "tvg-logo"),
      };
      continue;
    }

    if (!line.startsWith("#") && pending && /^https?:\/\//i.test(line)) {
      const name = pending.name;
      const base = slugify(`${pending.groupName}-${name}`) || `channel-${channels.length + 1}`;
      let slug = base;
      let suffix = 2;
      while (channels.some((channel) => channel.slug === slug)) {
        slug = `${base}-${suffix++}`;
      }
      channels.push({
        slug,
        name,
        groupName: pending.groupName,
        logoUrl: pending.logoUrl,
        streamUrl: line,
      });
      pending = null;
      if (channels.length >= max) break;
    }
  }

  return channels;
}

/** Only fetch public playlist hosts; admins cannot use this as an SSRF probe. */
export function isAllowedPlaylistUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return (
      url.hostname === "iptv-org.github.io" ||
      url.hostname === "raw.githubusercontent.com" ||
      url.hostname === "githubusercontent.com"
    );
  } catch {
    return false;
  }
}
