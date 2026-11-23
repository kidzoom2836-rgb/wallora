# WALLORA

**Discover. Chat. Imagine. Create. Share. Earn.**

WALLORA is an AI-powered creative ecosystem — discover inspiring wallpapers, converse with AI, generate original artwork, curate creative projects, and sell your work in the marketplace.

## Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York) + custom SVG icon system
- **Database**: PostgreSQL on Neon (Prisma ORM, pooled via PgBouncer)
- **Auth**: NextAuth.js v4 (JWT strategy, credentials provider, role hierarchy)
- **AI**: z-ai-web-dev-sdk (LLM chat + image generation)
- **Image processing**: Sharp (multi-variant asset pipeline)
- **Storage**: StorageAdapter abstraction — Local (dev) / Cloudflare R2 (prod)
- **State**: TanStack Query (server) + Zustand (client)

## Getting started

```bash
bun install
bun run db:push     # create schema on Neon
bun run db:seed     # seed categories, wallpapers, admin user, products
bun run dev
```

### Environment

Copy `.env.example` values into `.env` (never committed):

- `DATABASE_URL` — Neon pooled connection string (`?pgbouncer=true&connect_timeout=15`)
- `DIRECT_DATABASE_URL` — Neon direct connection (for migrations)
- `NEXTAUTH_SECRET` — JWT secret (`openssl rand -base64 32`)
- `NEXTAUTH_URL` — app base URL (e.g. `http://localhost:3000` in dev)
- `R2_*` (optional in dev, required on Vercel) — Cloudflare R2 credentials for object storage
- `PIXABAY_API_KEY` (optional) — enables the super-admin Pixabay wallpaper importer at
  `POST /api/v1/admin/wallpapers/import/pixabay`

### Seeded admin login

After `bun run db:seed`:

- Email: `admin@wallora.io`
- Password: `Wallora!Admin2025`

## Deployment (Vercel)

1. Push this repo to GitHub.
2. Import the project in Vercel.
3. Set the environment variables listed above (use the production domain for `NEXTAUTH_URL`, and configure `R2_*` for uploads).
4. Deploy. Vercel runs `prisma generate` + `next build` automatically.

## Project structure

```
prisma/            schema + seed scripts
src/app/           App Router pages + route groups (landing, (app), login/register)
src/app/api/v1/    REST API (auth, wallpapers, ai, projects, marketplace, admin)
src/components/    UI (landing, discovery, ai-chat, ai-studio, admin, marketplace, icons)
src/lib/           auth, db, storage, image, ai, quota
```

## License

WALLORA Showcase content is seeded under the WALLORA Showcase license.
