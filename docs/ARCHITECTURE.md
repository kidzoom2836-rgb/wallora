# Architecture

Monorepo managed with pnpm workspaces.

- apps/web: Next.js App Router (web + PWA)
- apps/mobile: Expo + React Native (Android)
- apps/worker: background jobs and image processing
- packages/*: shared libraries

## Status

Phase 13 — Final quality, security and release is in progress. The live web
platform is tracked in `WALLORA-web/docs/DEVELOPMENT_PHASES.md`; this repository
holds the native client, shared packages, web scaffold and worker.
