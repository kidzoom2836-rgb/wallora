# WALLORA — Development phases

Living status of the phases in the master product brief. "Live" means the feature is
implemented against the real database/API, not a mock array or a coming-soon toast.

| Phase | Name | Status | Where |
|---|---|---|---|
| 0 | Repository inspection and foundation | Complete | — |
| 1 | Branding and design system | Complete | `src/app/globals.css`, `src/components/brand` |
| 2 | Authentication and database | Complete | `/api/v1/auth/*`, NextAuth credentials + JWT |
| 3 | Discovery and wallpaper library | Complete | `/discover`, clickable cards, `/wallpaper/[slug]`, comments, likes, saves, downloads |
| 4 | Cloudflare media system | Complete (adapter) | `src/lib/storage/*`, R2 / Vercel Blob / DB adapters |
| 5 | WALLORA AI conversation engine | Complete | `/ai`, NVIDIA provider via server-only env |
| 6 | AI Studio and generation | Complete | `/studio`, `/api/v1/ai/generations` |
| 7 | Creative projects and studios | Complete | `/projects`, `/projects/showcase`, `/projects/[id]` |
| 8 | Community | Complete | `/community`, follows, comments, reposts, real share actions |
| 9 | Marketplace | Complete | `/marketplace`, product CRUD, purchases, entitlements |
| 10 | PWA | Complete | `public/manifest.webmanifest`, `public/sw.js`, registration in layouts |
| 11 | Native Android | Complete (source) | `apps/mobile` (Expo); APK is built through EAS |
| 12 | Admin dashboard | Complete | `/adminkenya`, hidden and server-gated to super admins |
| 13 | Final quality, security and release | In progress | Typecheck, live smoke tests, phase docs, release hardening |

## Notes
- Verification tiers are code + `StoredBlob` backed: `free` (grey, automatic),
  `verified` (blue), `premium` (gold), `supreme` (violet). Higher tiers are
  admin-reviewed at `/verification` and grant larger real limits.
- No Prisma migration is required for verification, projects metadata, community,
  showroom, sites or pro-user state — all use `StoredBlob` JSON stores.
- Card payments are intentionally not connected; purchases create real entitlement
  records and are labelled as a demo checkout in the UI.
- Stale "Phase 1 / Phase 9" marketing copy was corrected in `landing-data.ts`,
  `authenticated-panel.tsx`, `featured-showcase.tsx`, `marketplace-preview.tsx`
  and `site-footer.tsx`.
