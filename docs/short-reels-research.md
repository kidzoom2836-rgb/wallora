# WALLORA Reels — research and recommendation

## Short answer

WALLORA Reels is a vertical, full-screen short-video feed built on **royalty-free sources**:

1. Pexels Video API and Pixabay Video API for fresh 9:16 clips (free API keys),
2. a verified Pexels sample set so the feed works with no configuration, and
3. community video posts that carry a direct MP4/playable URL.

Live TV channels are deliberately **not** part of the Reels feed. Short drama apps that rely on
unofficial DramaBox/ReelShort/ShortMax endpoints, VIP unlocks, or scraped HLS/MP4 links are rejected:
they create copyright/ToS risk and break without notice.

## What I evaluated

| Option | Fit | Decision |
| --- | --- | --- |
| `fahmih6/dramabox_player`, `beranalpa/DramaBox-API*`, `FreeReels-API`, `dramabos-api`, `anichin-api` | High technical fit: catalogs, episode lists, direct HLS/MP4, sometimes VIP unlock | **Do not ship.** Unofficial endpoints, paywall circumvention, and third-party copyrighted catalogs create legal/ToS and reliability risk. |
| `xuliang2024/minitv` | Strong product reference: provider uploads, review/distribution, coin unlocks | Use as a **product pattern** for creator onboarding and rights workflow, not as a content source. |
| PeerTube | Open-source, federated, official REST API, self-hostable | Good **Phase 3 distribution backend** if WALLORA hosts its own shorts. |
| Pexels Video API | Free key, direct vertical MP4 links, attribution supported | **Phase 1 source.** `GET /videos/search?orientation=portrait`. |
| Pixabay Video API | Free key, `orientation=vertical`, direct MP4 links | **Phase 1 source.** `GET /api/videos/?orientation=vertical`. |
| Coverr | Royalty-free vertical stock clips | Backup stock source when Pixabay/Pexels keys are unavailable. |
| OpenMontage, PineDrama | AI studios for producing original vertical shorts | Good **content pipeline** ideas; AGPL/self-hosted. Useful for generating WALLORA-owned series. |

## Build path

### Phase 1 — Royalty-free vertical feed (shipped)
- `apps/mobile/lib/reels.ts` loads Pexels or Pixabay using keys saved in the Reels source settings.
- `orientation=portrait` (Pexels) / `orientation=vertical` (Pixabay) keeps results 9:16.
- With no key configured, the feed plays a verified set of public Pexels vertical MP4s
  (HTTP 206, `video/mp4`) so WALLORA Reels is never empty.
- `app/reels/index.tsx` renders a paging vertical feed with swipe, tap-to-pause,
  double-tap-to-like, share, and per-item source/license badges.
- Attribution: every reel keeps `creator`, `source`, and `creditUrl` so the origin is visible.

### Phase 2 — Creator shorts
- Add a dedicated `reels/new.tsx` upload flow with rights attestation.
- Add `durationSec`, `seriesId`, `episode`, `channelId`, and `license` metadata.
- Moderation queue in `/adminkenya` before a reel enters the public feed.

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

- Open WALLORA Reels → **Source** chip → choose Pexels or Pixabay → paste a free API key.
- Pexels key: https://www.pexels.com/api/
- Pixabay key: https://pixabay.com/api/docs/
- Keys are stored on-device with AsyncStorage; no key is shipped in the app bundle.

## What I need from you to proceed

1. Provide Pexels and/or Pixabay API keys if you want fresh, rotating content beyond the samples.
2. Confirm whether community video posts should later appear in Reels alongside stock clips.
3. Confirm that no paywall-bypassing drama APIs will be used in WALLORA.
