/**
 * Credential-free stream sources that can supplement WALLORA Live TV.
 *
 * Data only: no fetching, storage access, or other side effects. Every URL was
 * checked with `curl -sIL -o /dev/null -w '%{http_code}'` on 2026-11-23 and
 * returned HTTP 200. Third-party playlists can change without notice, so
 * individual channels still need to be validated before playback.
 */

export type StreamSource = {
  id: string;
  name: string;
  url: string;
  kind: "m3u" | "demo" | "service";
  description: string;
  homepage: string;
  language?: string;
  region?: string;
  notes?: string;
  verifiedAt: string;
};

export const STREAM_SOURCES: StreamSource[] = [
  {
    id: "edem-community",
    name: "EDEM_2 community playlist",
    url: "https://raw.githubusercontent.com/nn2wdw5jvc-max/mu-iptv/main/EDEM_2.m3u",
    kind: "m3u",
    description:
      "The EDEM_2 M3U WALLORA already uses as its default Live TV playlist (Russian-language channels and categories).",
    homepage: "https://github.com/nn2wdw5jvc-max/mu-iptv",
    language: "Russian",
    region: "International",
    notes:
      "HTTP 200 on verification. Community-maintained third-party list; entries can change or disappear. No account or subscription is needed to read the file, but check local rights/geo rules for individual channels.",
    verifiedAt: "2026-11-23",
  },
  {
    id: "iptv-org-all",
    name: "iptv-org · all channels",
    url: "https://iptv-org.github.io/iptv/index.m3u",
    kind: "m3u",
    description:
      "Main index from iptv-org/iptv: publicly submitted channels from around the world, grouped by country and language.",
    homepage: "https://github.com/iptv-org/iptv",
    region: "Worldwide",
    notes:
      "HTTP 200 on verification. The project hosts no video, only public links, and removes links on rights claims. Free to read with no signup; availability varies by region.",
    verifiedAt: "2026-11-23",
  },
  {
    id: "iptv-org-us",
    name: "iptv-org · United States channels",
    url: "https://iptv-org.github.io/iptv/countries/us.m3u",
    kind: "m3u",
    description:
      "Country subset from iptv-org/iptv listing publicly available US channels. The file is published in the repo's Pages output.",
    homepage: "https://github.com/iptv-org/iptv",
    region: "United States",
    notes:
      "HTTP 200 on verification. Same community/copyright terms as the main iptv-org list; some feeds may be geo-restricted or short-lived.",
    verifiedAt: "2026-11-23",
  },
  {
    id: "iptv-org-english",
    name: "iptv-org · English channels",
    url: "https://iptv-org.github.io/iptv/languages/eng.m3u",
    kind: "m3u",
    description:
      "Language subset from iptv-org/iptv for channels broadcasting in English, published in the repo's Pages output.",
    homepage: "https://github.com/iptv-org/iptv",
    language: "English",
    region: "Worldwide",
    notes:
      "HTTP 200 on verification. Same community/copyright terms as the main iptv-org list; links are user-submitted and can expire.",
    verifiedAt: "2026-11-23",
  },
  {
    id: "free-tv-iptv",
    name: "Free-TV/IPTV",
    url: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8",
    kind: "m3u",
    description:
      "Free-TV/IPTV's curated M3U8 of mainstream free-to-air channels (Plex, Pluto TV, Roku, Samsung TV Plus and others).",
    homepage: "https://github.com/Free-TV/IPTV",
    region: "Worldwide",
    notes:
      "HTTP 200 on verification. Project policy excludes paid and adult channels; some entries are marked geo-blocked and availability can change.",
    verifiedAt: "2026-11-23",
  },
  {
    id: "mux-hls-demo",
    name: "Mux HLS demo stream",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    kind: "demo",
    description:
      "Mux's public Big Buck Bunny HLS test stream, already used by WALLORA's fallback demo channels.",
    homepage: "https://mux.com/",
    notes:
      "HTTP 200 on verification. Vendor test asset for playback checks only, not a live TV service; availability is controlled by Mux.",
    verifiedAt: "2026-11-23",
  },
  {
    id: "unified-hls-demo",
    name: "Unified Streaming HLS demo",
    url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    kind: "demo",
    description:
      "Unified Streaming's public Tears of Steel HLS demo stream, already used by WALLORA's fallback demo channels.",
    homepage: "https://demo.unified-streaming.com/",
    notes:
      "HTTP 200 on verification. Vendor demo asset for playback checks only, not a live TV service; availability is controlled by Unified Streaming.",
    verifiedAt: "2026-11-23",
  },
  {
    id: "shaka-hls-demo",
    name: "Shaka Player HLS demo",
    url: "https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8",
    kind: "demo",
    description:
      "Shaka Player's public Angel One HLS demo asset, already used by WALLORA's fallback demo channels.",
    homepage: "https://shaka-player-demo.appspot.com/demo/",
    notes:
      "HTTP 200 on verification. Public demo asset for playback checks only, not a live TV service; availability is controlled by the Shaka project.",
    verifiedAt: "2026-11-23",
  },
];

const FEATURED_SOURCE_IDS = [
  "edem-community",
  "iptv-org-all",
  "free-tv-iptv",
  "mux-hls-demo",
  "shaka-hls-demo",
];

export const FEATURED_SOURCES: StreamSource[] = STREAM_SOURCES.filter((source) =>
  FEATURED_SOURCE_IDS.includes(source.id),
);

/** Human-readable label for a source, with its language/region when useful. */
export function sourceLabel(source: StreamSource): string {
  const scope = source.language ?? source.region;
  if (!scope || source.name.includes(scope)) return source.name;
  return `${source.name} (${scope})`;
}
