# Studio Page — Work Record

**Task ID:** Studio Page
**Agent:** z-ai-code
**File created:** `src/app/(app)/studio/page.tsx`
**Status:** Complete

## Summary

Created a dedicated full-page AI Studio at `src/app/(app)/studio/page.tsx` (a Next.js 16
App Router client component inside the existing `(app)` route group). The page lets
authenticated users generate images via AI, with a desktop sidebar of controls and a
scrollable output gallery.

## Key decisions

- **Client component** (`"use client"`) — required for TanStack Query + `useSession` +
  interactive state.
- **Root height** `h-[calc(100vh-4rem)]` so the page fills the viewport below the shared
  sticky header (`h-16` = 4rem) defined in `src/app/(app)/layout.tsx`.
- **Layout:** `flex` row → desktop sidebar (`w-80`, `hidden lg:flex flex-col`) + main area
  (`flex-1 flex flex-col overflow-hidden`). The gallery is `flex-1 overflow-y-auto`.
- **Mobile:** prompt textarea + style/aspect selects + auto-enhance toggle + generate
  button render in a `border-b` strip above the gallery (`lg:hidden`).

## Data fetching (TanStack Query)

- `useQuery(["ai-presets"])` → `GET /api/v1/ai/presets` (used for the dynamic credit cost).
- `useQuery(["generations"])` → `GET /api/v1/ai/generations?limit=12` (enabled only when
  authenticated).
- `useMutation` for generate (`POST /api/v1/ai/generations`), retry
  (`POST /api/v1/ai/generations/[id]/retry`), and delete
  (`DELETE /api/v1/ai/generations/[id]`). All invalidate `["generations"]` on success.
- Toast feedback via `sonner` for every mutation outcome.

## Icons

All icons imported from `@/components/icons/wallora-icons` (NO lucide-react):
`SparklesIcon, LoaderIcon, DownloadIcon, RefreshIcon, TrashIcon, AlertIcon,
CheckCircleIcon, ImageIcon, WandIcon`. Spinner uses Tailwind `animate-spin`.

## Style presets & aspect ratios

Imported directly from `@/lib/ai/presets` (`STYLE_PRESETS`, `ASPECT_RATIOS`). The preset
`icon` field (a LucideIcon) is intentionally **not rendered** — buttons show the name text
only, per the no-lucide rule. 12 preset buttons in a 2-col grid; 3 aspect-ratio selectors
with visual ratio indicators in a 3-col grid.

## Auth gate

`useSession()` from `next-auth/react`. Three render branches:
1. `status === "loading"` → centered spinner.
2. Not authenticated → centered "Sign in to use AI Studio" prompt with a button that opens
   the shared auth dialog via `useAuthDialog().openSignIn`.
3. Authenticated → full studio UI.

## Theme

Uses the WALLORA premium-dark tokens from `globals.css`: `bg-background`, `bg-surface`,
`bg-raised`, `border-border`, `text-foreground`, `text-secondary-text`, `text-primary`,
`bg-primary`, `text-primary-foreground`.

## UX touches

- Cmd/Ctrl+Enter triggers Generate from the prompt textarea.
- Character counter (`{prompt.length}/2000`).
- Hover overlay on completed cards with download / variation / delete actions.
- Failed cards show inline error message + a Retry button.
- Empty state with clickable example prompts.
- Loading placeholder card shown while a generation is in flight.

## Verification

- `bun run lint` — passed, no errors.
- Dev server (`bun run dev`) compiled the route without errors.
- No existing files modified. No packages installed.
