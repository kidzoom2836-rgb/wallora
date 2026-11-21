# Phase 7 — Creative Projects

## Task
Build the Creative Projects feature (Phase 7 of WALLORA).

## Scope
- 5 API route handlers (all auth-required, owner-checked) under
  `src/app/api/v1/projects/`
- 1 Zustand store at `src/stores/projects.ts`
- 1 full-screen overlay UI component at
  `src/components/landing/projects-panel.tsx`

## Constraints honored
- Did NOT modify any existing files (page.tsx, layout.tsx, schema.prisma,
  user-menu.tsx, etc.). The projects-panel.tsx is created as a self-contained
  overlay controlled by the Zustand store, ready to be mounted in page.tsx
  later by the user (cannot modify page.tsx per task rules).
- No new npm packages installed — used only existing deps:
  zod, @tanstack/react-query, framer-motion, lucide-react, sonner,
  next-auth/react, shadcn/ui primitives.
- Prisma schema models were already defined (CreativeProject, ProjectAsset,
  ProjectNote) and were left untouched.

## Files created
1. `src/stores/projects.ts` — Zustand store (open, selectedProjectId, setters)
2. `src/app/api/v1/projects/route.ts` — GET list + POST create
3. `src/app/api/v1/projects/[id]/route.ts` — GET single, PATCH, DELETE
4. `src/app/api/v1/projects/[id]/assets/route.ts` — POST add asset, GET list
5. `src/app/api/v1/projects/[id]/notes/route.ts` — POST add note, GET list
6. `src/lib/projects.ts` — shared `enrichProjectAssets` helper (bulk-fetches
   related Wallpaper + AiGeneration rows for a list of ProjectAssets). The
   Prisma schema declares `ProjectAsset.wallpaperId` / `generationId` as bare
   scalars without relations, so enrichment is done via two `findMany({ where:
   { id: { in: [...] } } })` calls instead of nested `select`.
7. `src/components/landing/projects-panel.tsx` — full-screen overlay panel

## Patterns followed
- `requireUser()` for auth in every route
- Owner check before every project-scoped operation (404 if not owner — never
  reveals existence to other users)
- Zod schemas for input validation
- `{ error: { code, message } }` for errors, `{ data }` / `{ data, message }`
  for successes, 201 on creates
- Premium dark aesthetic (bg-background / bg-surface / bg-raised,
  text-foreground / text-secondary-text, border-border, primary gold #D7B879)
- TanStack Query + Framer Motion in the panel
- `useSession` gating — panel only renders when authenticated
- Mobile responsive: sidebar hidden on mobile, stacked layout with a back
  button when a project is selected

## E2E verification (executed 2026-11-21)
All endpoints exercised end-to-end with two real NextAuth-authenticated users
created via `/api/v1/auth/register` + the NextAuth credentials callback.

| Endpoint | Method | Result |
| --- | --- | --- |
| `/api/v1/projects` | GET (no auth) | 401 unauthorized |
| `/api/v1/projects` | GET (auth, empty) | 200 `{ data: [] }` |
| `/api/v1/projects` | POST | 201 created, message returned |
| `/api/v1/projects` | GET (auth, 1 project) | 200 list with assetCount/noteCount |
| `/api/v1/projects/[id]` | GET (owner) | 200 detail with assets+notes |
| `/api/v1/projects/[id]` | GET (non-owner) | 404 not_found (existence hidden) |
| `/api/v1/projects/[id]` | PATCH | 200 updated |
| `/api/v1/projects/[id]` | DELETE | 200 `{ deleted: true }` |
| `/api/v1/projects/[id]/notes` | POST (valid) | 201 created |
| `/api/v1/projects/[id]/notes` | POST (601 chars) | 400 validation_error |
| `/api/v1/projects/[id]/notes` | GET | 200 list |
| `/api/v1/projects/[id]/assets` | POST (missing wallpaperId) | 400 validation_error |
| `/api/v1/projects/[id]/assets` | POST (invalid assetType) | 400 validation_error |
| `/api/v1/projects/[id]/assets` | POST (valid wallpaper) | 201 created |
| `/api/v1/projects/[id]/assets` | POST (duplicate wallpaper) | 409 conflict |
| `/api/v1/projects/[id]/assets` | POST (foreign user's wallpaper) | 404 not_found |
| `/api/v1/projects/[id]/assets` | POST (non-owner project) | 404 not_found |
| `/api/v1/projects/[id]/assets` | GET | 200 list with enriched wallpaper/gridAsset + generation/publicUrl |

Wallpaper enrichment verified: `wallpaper.title`, `wallpaper.gridAsset.objectKey`,
`note` all populated correctly in both the project detail and the assets list.

ESLint: `bun run lint` passes with zero errors and zero warnings on the new files.

## How to mount the panel
Add to `src/app/page.tsx` (after AiStudioPanel) when ready:
```tsx
import { ProjectsPanel } from "@/components/landing/projects-panel";
// ... inside Home()
<ProjectsPanel />
```
And trigger from anywhere via:
```tsx
import { useProjects } from "@/stores/projects";
const openProjects = useProjects((s) => s.openPanel);
openProjects();
```
