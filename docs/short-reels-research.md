# WALLORA Reels — research and recommendation

## Short answer

WALLORA Reels is a vertical, full-screen short-video feed built on **vetted sources**:

1. the YouTube Data API (`videoDuration=short`) for a personalized For You feed, played in an
   in-app WebView embed,
2. the Pixabay Video API as the default stock fallback (`orientation=vertical`, direct MP4),
3. Pexels Video API as an on-device alternative,
4. a verified Pexels sample set so the feed still works if the API is unreachable, and
5. community video posts that carry a direct MP4/playable URL.

YouTube videos come from official search results only. No TV channels, drama APIs, VIP unlocks or
scraped streams are used.

Live TV channels are deliberately **not** part of the Reels feed. Short drama apps that rely on
unofficial DramaBox/ReelShort/ShortMax endpoints, VIP unlocks, or scraped HLS/MP4 links are rejected:
they create copyright/ToS risk and break without notice.

## What I evaluated

| Option | Fit | Decision |
| --- | --- | --- |
| `fahmih6/dramabox_player`, `beranalpa/DramaBox-API*`, `FreeReels-API`, `dramabos-api`, `anichin-api` | High technical fit: catalogs, episode lists, direct HLS/MP4, sometimes VIP unlock | **Do not ship.** Unofficial endpoints, paywall circumvention, and third-party copyrighted catalogs create legal/ToS and reliability risk. |
| `xuliang2024/minitv` | Strong product reference: provider uploads, review/distribution, coin unlocks | Use as a **product pattern** for creator onboarding and rights workflow, not as a content source. |
| PeerTube | Open-source, federated, official REST API, self-hostable | Good **Phase 3 distribution backend** if WALLORA hosts its own shorts. |
| Pexels Video API | Free key, direct vertical MP4 links, attribution supported | **Alternative source.** `GET /videos/search?orientation=portrait`. |
| YouTube Data API v3 | Official short-video search, channel/title metadata, embeds | **For You source.** `search?videoDuration=short` plus `videos?part=snippet,statistics,contentDetails`; playback in `react-native-webview`. |
| Pixabay Video API | Free key, `orientation=vertical`, direct MP4 embeds | **Stock fallback / live-wallpaper clips.** `GET /api/videos/?orientation=vertical`. |
| Coverr | Royalty-free vertical stock clips | Backup stock source when Pixabay/Pexels keys are unavailable. |
| OpenMontage, PineDrama | AI studios for producing original vertical shorts | Good **content pipeline** ideas; AGPL/self-hosted. Useful for generating WALLORA-owned series. |

## Build path

### Phase 1 — Royalty-free vertical feed (shipped)
- `apps/mobile/lib/reels.ts` loads Pixabay by default, with Pexels as a switchable source.
- A shared free Pixabay key ships with the app so Reels works without setup; users can paste
  their own key in Source settings to get a private quota. Any key entered in settings is stored
  on-device with AsyncStorage.
- `orientation=portrait` (Pexels) / `orientation=vertical` (Pixabay) keeps results 9:16. Pixabay's
  orientation filter is loose, so the app requests the maximum 200 results per page, filters
  portrait renditions locally, and picks the smallest file under a 12 MB budget so reels stay
  scrollable on low-bandwidth connections.
- Pixabay responses are cached in AsyncStorage for **24 hours**, as required by the Pixabay API.
  Stale cache is served before the sample fallback when the API is unavailable.
- With no API access, the feed plays a verified set of public Pexels vertical MP4s
  (HTTP 206, `video/mp4`) so WALLORA Reels is never empty.
- `app/reels/index.tsx` renders a paging vertical feed with swipe, tap-to-pause,
  double-tap-to-like, share, and per-item source/license badges.
- Attribution: every reel keeps `creator`, `source`, and `creditUrl` so the origin is visible.
  Videos are embedded directly; Pixabay's no-permanent-hotlinking rule applies to images, not videos.

### Phase 1.5 — Personalized For You (shipped)
- Reels opens with a first-run topic picker. Saved interests drive up to five YouTube short searches,
  interleaved for variety and ranked by likes, topic affinity and view count.
- Tabs: **For You**, **Search** (YouTube shorts by keyword) and **Topics** (update interests).
- Likes are stored on-device and improve future ranking; no profile data leaves the device.
- Quickly swiping past a reel lowers that topic's affinity, so the feed adapts to skips as well as likes.
- Each visit rotates the interest order and feed starting point, demotes already-seen reels, and
  resumes at the last reel watched. The feed therefore changes on return instead of repeating.
- Optional **auto-advance** (play button in the Reels header) moves to the next reel every 8 seconds;
  it pauses on interaction, when a dialog is open, or when the app is backgrounded.
- YouTube embeds use `autoplay`, inline playback and loop parameters, with the official YouTube
  controls available so playback is user-initiated where platform policy requires it.
- A local `EXPO_PUBLIC_YOUTUBE_API_KEY` in the gitignored `apps/mobile/.env` is used for development.
  Provider keys will move into admin-managed server settings before production.
- Pixabay vertical clips remain available as low-bandwidth stock/live-wallpaper reels.

### Phase 2 — Creator shorts and wallpaper library
- Add a dedicated `reels/new.tsx` upload flow with rights attestation.
- Add `durationSec`, `seriesId`, `episode`, `channelId`, and `license` metadata.
- Moderation queue in `/adminkenya` before a reel enters the public feed.
- Super admins can import categorized Pixabay photos from **Profile → Admin imports**. The server
  route `POST /api/v1/admin/wallpapers/import/pixabay` uses `PIXABAY_API_KEY`, caches responses for
  24 hours, stores responsive variants, attributes each photo to Pixabay, and publishes approved
  wallpapers under the verified `@wallora` account so they appear in Discover.

### Phase 3 — Licensed partners and stock
- Add partner feeds only with signed license agreements and official APIs.
- Optional PeerTube backend if WALLORA self-hosts its own shorts.

## Data model sketch

```prisma
model Reel {
  id          String   @id @default(cuid())
  authorId    String
  videoUrl    String
  posterUrl   String?
  durationSec Int
  seriesId    String?
  episode     Int?
  channelId   String?
  license     String   @default("original")
  status      String   @default("pending") // pending | approved | rejected
  createdAt   DateTime @default(now())
}
```

## Configuration

- WALLORA Reels → **Source** chip → choose **YouTube**, **Pixabay** or **Pexels**.
- For local development, put a YouTube Data API v3 key in `apps/mobile/.env` as
  `EXPO_PUBLIC_YOUTUBE_API_KEY`. The file is gitignored; never commit provider keys.
- Pixabay works out of the box with the shared built-in key. To use your own quota, paste a free
  key from https://pixabay.com/api/docs/ into the Source settings.
- Pexels is optional: https://www.pexels.com/api/
- The Discover wallpaper importer needs `PIXABAY_API_KEY` on the web/backend server. Add it to the
  deployment environment and use **Profile → Admin imports** from a super-admin account.
- Any key you enter is stored on-device with AsyncStorage. The built-in Pixabay key is public in
  the app bundle and rate-limited, so replace it in settings if traffic gets high.
- API responses are cached for 24 hours; pull-to-refresh is an explicit human request and may
  bypass the cache once.

## What I need from you to proceed

1. Confirm whether community video posts should later appear in Reels alongside stock clips.
2. Confirm that no paywall-bypassing drama APIs will be used in WALLORA.
