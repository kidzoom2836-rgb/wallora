# WALLORA Reels — research and recommendation

## Short answer

The repos in the research note technically match “free short dramas”, but most of them work by
calling unofficial DramaBox/ReelShort/ShortMax endpoints, unlocking VIP episodes, or reselling
scraped HLS/MP4 links. That is a fast way to get a copyright complaint, an account ban, or a
sudden API shutdown — not a foundation for WALLORA.

WALLORA should build **WALLORA Reels** from content it can actually stand behind:

1. the 9-second clips now captured directly from licensed/available live channels,
2. original shorts uploaded by verified creators,
3. licensed partner shorts, and
4. royalty-free stock clips for templates and filler.

## What I evaluated

| Option | Fit | Decision |
| --- | --- | --- |
| `fahmih6/dramabox_player`, `beranalpa/DramaBox-API*`, `FreeReels-API`, `dramabos-api`, `anichin-api` | High technical fit: catalogs, episode lists, direct HLS/MP4, sometimes VIP unlock | **Do not ship.** Unofficial endpoints, paywall circumvention, and third-party copyrighted catalogs create legal/ToS and reliability risk. |
| `xuliang2024/minitv` | Strong product reference: provider uploads, review/distribution, coin unlocks | Use as a **product pattern** for creator onboarding and rights workflow, not as a content source. |
| PeerTube | Open-source, federated, official REST API, self-hostable | Good **Phase 3 distribution backend** if WALLORA hosts its own shorts. |
| Pexels / Pixabay / Coverr APIs | Royalty-free vertical stock clips, free commercial use | Good for **trailers, templates, and fillers** once API keys are available. |
| OpenMontage, PineDrama | AI studios for producing original vertical shorts | Good **content pipeline** ideas; AGPL/self-hosted. Useful for generating WALLORA-owned series. |

## Recommended build path

### Phase 1 — First-party reels (now possible)
- Reuse `community.channel_clip` posts and the new live-capture endpoint.
- Feed a vertical, full-screen `app/reels/index.tsx` from posts that have `videoUrl`.
- Swipe up/down, tap to pause, double-tap to like, and reuse existing community like/comment/share APIs.
- Show source badges: `WALLORA TV · channel name`, `Community · creator`, or `Stock · license`.

### Phase 2 — Creator shorts
- Add a dedicated `reels/new.tsx` upload flow with rights attestation.
- Add `durationSec`, `seriesId`, `episode`, `channelId`, and `license` metadata.
- Moderation queue in `/adminkenya` before a reel enters the public feed.

### Phase 3 — Licensed partners and stock
- Integrate Pexels/Pixabay only with API keys and attribution stored on each asset.
- Add partner feeds only with signed license agreements and official APIs.

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

## What I need from you to proceed

1. Confirm Phase 1 MVP: WALLORA TV clips + community shorts only.
2. Decide whether to add Pexels/Pixabay in Phase 2 and provide API keys.
3. Confirm that no paywall-bypassing drama APIs will be used in WALLORA.
