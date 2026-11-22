# WALLORA

AI-powered creative ecosystem and visual social platform.

Tagline: Discover. Chat. Imagine. Create. Share. Earn.

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Git

## Setup

```bash
pnpm install
cp .env.example .env.local
```

Fill in environment variables in `.env.local` (see `.env.example`).

## Development

```bash
# Web (Next.js)
pnpm dev:web

# Worker
pnpm dev:worker

# Mobile (Expo)
pnpm dev:mobile
```

## Quality

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Project structure

See `docs/ARCHITECTURE.md`.

## Phases

Development is phased. See `docs/DEVELOPMENT_PHASES.md`. Do not skip phases.
