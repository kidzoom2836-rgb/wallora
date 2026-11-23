# WALLORA Live TV — public playlist sources

## Review of `iptv-org/iptv`

`iptv-org/iptv` is the largest maintained open collection of publicly available live-stream links.
It is a legitimate source for WALLORA Live TV **as long as it stays in the Live TV guide and never
enters Reels** (Reels remains vetted shorts only: YouTube/Pixabay/Pexels).

Verified on 2026-11-23:

| Playlist | URL | Channels |
| --- | --- | --- |
| Full index | `https://iptv-org.github.io/iptv/index.m3u` | 11,505 (2.66 MB) |
| Category: News | `https://iptv-org.github.io/iptv/categories/news.m3u` | 1,069 |
| Category: Sports | `https://iptv-org.github.io/iptv/categories/sports.m3u` | 527 |
| Category: Movies | `https://iptv-org.github.io/iptv/categories/movies.m3u` | 771 |
| Category: Kids | `https://iptv-org.github.io/iptv/categories/kids.m3u` | 454 |
| Country: Kenya | `https://iptv-org.github.io/iptv/countries/ke.m3u` | 39 |

Other groupings exist: `index.category.m3u`, `index.language.m3u`, `index.country.m3u`,
`categories/<slug>.m3u`, `languages/<code>.m3u`, `countries/<code>.m3u`.

### What the project actually guarantees

- The repository stores **no video**. It only indexes links that third parties have made public.
- It claims to list free-to-air/public streams, and it has a copyright-takedown issue template.
- That is **not** a legal guarantee per channel. Rights and geo rules still vary by country.

### Practical limitations found in the data

- Many entries are tagged `[Geo-blocked]`, `[Not 24/7]`, or use plain `http://` streams.
  Android allows cleartext traffic in WALLORA; iOS ATS will reject `http://` feeds.
- Some entries require a custom `User-Agent` via `#EXTVLCOPT:http-user-agent`. The current
  parser does not store that requirement, so those channels may fail to play.
- Public links rot. A periodic re-sync is needed; dead channels should be hidden, not deleted.

### Recommendation

Prefer small, curated subsets (Kenya first, then News/Sports/Kids) over the full 11.5k index.
Hidden/dead channels cost database rows and make the guide noisy. Use the full index only when a
specific catalog is needed.

## On-device fallback (available now)

While the backend is not deployed, `apps/mobile/lib/iptv.ts` loads the curated iptv-org playlists
directly on the device as a fallback when `/api/v1/channels` returns no usable channels. It merges
Kenya, News, Sports, Movies and Kids (roughly 2,800 channels), caches them for 6 hours, and labels
the guide **WALLORA TV · iptv-org**. Once the backend guide has channels, it takes priority again.
A custom M3U URL in Live TV → Settings still overrides everything.

## Import procedure

1. Deploy the backend branch so `/api/v1/channels/sync` is current.
2. Sign in as a super admin and open **Admin → TV → WALLORA TV guide**.
3. Pick an **iptv-org preset** (or paste a URL), press **Preview**, then **Sync to database**.
4. In the app, the backend guide is the default source. A per-device custom M3U URL in
   **Live TV → Settings** still overrides it.

The sync endpoint only accepts HTTPS playlists from `iptv-org.github.io`,
`raw.githubusercontent.com`, and `githubusercontent.com` to prevent SSRF abuse. M3U source URLs
live in the backend database, not in the shipped app bundle.
