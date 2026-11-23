# Development Phases

The web platform is authoritative and tracks the canonical phase status in
`WALLORA-web/docs/DEVELOPMENT_PHASES.md`.

| Phase | Name                                 | Status             |
| ----- | ------------------------------------ | ------------------ |
| 0     | Repository inspection and foundation | Complete           |
| 1     | Branding and design system           | Complete           |
| 2     | Authentication and database          | Complete           |
| 3     | Discovery and wallpaper library      | Complete           |
| 4     | Cloudflare media system              | Complete (adapter) |
| 5     | WALLORA AI conversation engine       | Complete           |
| 6     | AI Studio and generation             | Complete           |
| 7     | Creative projects and studios        | Complete           |
| 8     | Community                            | Complete           |
| 9     | Marketplace                          | Complete           |
| 10    | PWA                                  | Complete           |
| 11    | Native Android                       | Complete (source)  |
| 12    | Admin dashboard                      | Complete           |
| 13    | Final quality, security and release  | In progress        |

The native client lives at `apps/mobile` in the main repository.

## Phase 13 verification (this repository)

- `pnpm typecheck` — clean across all apps and packages.
- `pnpm lint` — clean across all apps and packages.
- `pnpm test` — worker bootstrap smoke tests pass.
- `pnpm build` — web app builds; worker emits `dist/index.js`.
- CI runs typecheck, lint, tests and the web build on every push and PR.
- Security: `/api/v1/seed` is development-only; `/admin/*` is server-gated to
  users with the `admin` or `super_admin` role.

Known remaining debt: `pnpm format:check` still reports pre-existing style drift
in older files; new and modified files are formatted.
