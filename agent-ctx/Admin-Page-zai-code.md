# Task: Admin Page

**Agent:** zai-code
**File created:** `src/app/(app)/admin/page.tsx` (single file, no existing files modified)
**Route:** `/admin` (inside the `(app)` route group, which shares the sticky `AppHeader` layout)

## What was built

A dedicated Admin Dashboard **page** (`"use client"`) with three tabs:

1. **Overview** — a responsive grid of stat cards (2 cols mobile / 3 sm / 5 lg)
   rendered from real `GET /api/v1/admin/stats` metrics:
   Total Users, Wallpapers, Pending Review, AI Conversations, AI Messages,
   AI Generations, Comments, Products, Purchases, Waitlist Entries.
   Each stat card follows the spec exactly: a big number
   (`font-display text-2xl font-semibold text-foreground`) over a label
   (`text-xs uppercase text-secondary-text`). A secondary row shows a
   "Today" card, a wallpaper status breakdown bar, and a top-categories list.

2. **Users** — `GET /api/v1/admin/users` rendered as a desktop table
   (sticky header, scrollable `max-h-[70vh]`) and a mobile card list, with
   role/status `Badge`s, verified checkmark, and prev/next pagination.

3. **Moderation** — `GET /api/v1/admin/wallpapers?status=pending` (with a
   pending/approved/rejected/flagged filter) rendered as a responsive grid of
   wallpaper cards. Each card shows the preview image, status pill, creator,
   category and Approve / Reject / Flag buttons wired to
   `PATCH /api/v1/admin/wallpapers/[id]/moderate` via `useMutation`.

## Key implementation details

- **Auth + role gate:** `useSession` from `next-auth/react`. The whole page is
  gated on `session.user.role` being `"admin"` or `"super_admin"`. While the
  session loads, a spinner is shown; otherwise non-admins see
  *"Access denied — admin role required."* (server-side `requireRole` already
  enforces this on every API).
- **Data fetching:** TanStack Query `useQuery` for stats/users/wallpapers
  (with `keepPreviousData` for paginated tabs) and `useMutation` for moderate.
  On success the mutation invalidates `["admin-wallpapers"]` and
  `["admin-stats"]`; on error it surfaces the server message.
- **Toasts:** `sonner` `toast.success` / `toast.error` on every moderation
  action.
- **Icons:** All icons come from
  `@/components/icons/wallora-icons` — `DashboardIcon`, `UserIcon`,
  `ImageIcon`, `CheckIcon`, `AlertIcon`, `LoaderIcon`, `EyeIcon`. No
  `lucide-react` import anywhere.
- **Theme:** Premium dark tokens only — `bg-background`, `bg-surface`,
  `bg-raised`, `border-border`, `text-foreground`, `text-secondary-text`,
  `text-primary`, `font-display`, `bg-success`, `bg-destructive`.
- **shadcn/ui:** `Button` (default/destructive/outline variants, `sm` size)
  and `Badge` (default/secondary/destructive/outline).
- **Layout:** Root `<div className="bg-background p-6">` wraps a
  `mx-auto max-w-7xl` content column, sitting under the shared 4rem sticky
  header provided by the `(app)` layout.
- **Responsive + accessible:** mobile-first grids, sticky table headers,
  `max-h` scroll regions, `role="tablist"/"tab"` + `aria-selected` for the
  main tabs, `aria-pressed` for the status filter, descriptive alt text,
  keyboard-reachable buttons, loading skeletons and empty/error states.

## Data-shape notes

The real API responses differ slightly from the task description (the
description was idealized). The page uses the **actual** shapes returned by
the existing endpoints:
- `/api/v1/admin/users` → `{ data: { items: [...], pagination } }` with items
  carrying `wallpaperCount` / `conversationCount` (not `_count`).
- `/api/v1/admin/wallpapers` → items carry a single `asset` (`objectKey` used
  directly as the `<img src>`, matching the existing `wallpaper-card` /
  `admin-panel` convention) and a `creator` object.

## Verification

- `bun run lint` → **0 errors, 0 warnings**.
- Dev server: `GET /admin` → **200**, compiles and renders with no errors in
  `dev.log`.

## Constraints honoured

- Created ONLY `src/app/(app)/admin/page.tsx`.
- Did not modify any existing file.
- No `lucide-react` imports.
- No packages installed.
