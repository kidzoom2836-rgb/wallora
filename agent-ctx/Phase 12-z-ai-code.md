# Phase 12 — Admin Dashboard

**Agent:** Z.ai Code (fullstack)
**Task ID:** Phase 12
**Scope:** Build the WALLORA Admin Dashboard feature (overlay + 4 API routes + Zustand store).

## Files created (no existing files modified)

### 1. API routes — all require admin/moderator role server-side

- `src/app/api/v1/admin/stats/route.ts`
  - `GET /api/v1/admin/stats`
  - Auth: `requireRole(ROLES.MODERATOR)` (admin also passes via hierarchy).
  - Returns REAL aggregate metrics via `db.count()` / `db.aggregate()` /
    `db.category.findMany({ _count })` — no synthetic data.
  - Returns: `totalUsers, totalWallpapers, pendingWallpapers, totalConversations,
    totalMessages, totalGenerations, totalComments, totalProducts, totalPurchases,
    totalWaitlistEntries, todayAiUsage, todayNewUsers, todayNewWallpapers,
    wallpapersByStatus {approved,pending,rejected,flagged}, topCategories (top 5
    by wallpaper count, via `_count` aggregation ordered desc).
  - 17 queries run in a single `Promise.all` for fast response.

- `src/app/api/v1/admin/users/route.ts`
  - `GET /api/v1/admin/users?page=1&limit=50`
  - Auth: `requireRole(ROLES.MODERATOR)`.
  - Returns paginated users (limit 50, hard cap) sorted by `createdAt desc`.
  - Each item includes: id, email, name, image, role, status, createdAt,
    profile (username, displayName, verified, creatorStatus, avatarUrl),
    wallpaperCount, conversationCount (via Prisma `_count`).

- `src/app/api/v1/admin/wallpapers/route.ts`
  - `GET /api/v1/admin/wallpapers?status=pending&page=1&limit=24`
  - Auth: `requireRole(ROLES.MODERATOR)`.
  - status filter accepts `pending|approved|rejected|flagged`; defaults to
    `pending`; if no recognised status is passed, lists everything except
    `removed`.
  - Each item includes creator info + asset preview (grid → thumbnail →
    original fallback), tags, counters, category, license, sourceType.

- `src/app/api/v1/admin/wallpapers/[id]/moderate/route.ts`
  - `PATCH /api/v1/admin/wallpapers/[id]/moderate`
  - Auth: `requireRole(ROLES.ADMIN)` — stricter (admin only).
  - Body: `{ status: "approved" | "rejected" | "flagged" }` (validated against
    an allow-list).
  - Fetches prior wallpaper state, updates status, then writes an
    `AuditLog` entry recording `actorId`, `action=wallpaper.moderate:{status}`,
    `targetType=wallpaper`, `targetId=id`, and metadata JSON
    `{from, to, title, slug}` for full traceability.
  - Returns the updated wallpaper.

### 2. Zustand store

- `src/stores/admin.ts`
  - `useAdminPanel` store with `{ open, openAdmin, setOpen }`.
  - Mirrors the pattern used by `useAiStudio` / `useAiChat`.

### 3. UI component

- `src/components/landing/admin-panel.tsx`
  - `"use client"`.
  - Full-screen overlay (`fixed inset-0 z-[60]`) controlled by `useAdminPanel`.
  - Framer Motion enter/exit + tab switching transitions.
  - Header: WALLORA logo + "Admin Dashboard" + "Phase 12" gold badge + close
    button (Esc to close, body scroll lock while open).
  - Tab navigation: Overview | Users | Moderation (with live pending count
    badge pulled from stats query).
  - Overview tab: 10 stat cards in a responsive grid
    (Users, Wallpapers, Pending, AI conversations, AI messages, AI generations,
    Comments, Products, Purchases, Waitlist), plus 3 secondary cards:
    "Today" (credits/users/wallpapers), "Wallpaper status" (stacked bar),
    "Top categories" (top 5 ordered list). Lucide icons throughout.
  - Users tab: paginated desktop `<table>` + mobile card list; RoleBadge and
    StatusBadge with role/condition-appropriate colours; verified check.
  - Moderation tab: filterable grid of wallpapers (status pill, source/license
    badges, view/like/download counts, category). Each card has Approve /
    Flag / Reject buttons that call the moderate API via TanStack mutation;
    on success it invalidates both the wallpapers and stats queries.
  - TanStack Query (`useQuery`, `useMutation`, `keepPreviousData`) for all
    data fetching.
  - `useSession()` re-verifies role on the client: only `admin`/`super_admin`
    see moderation actions; moderators see read-only; everyone else sees an
    "Access denied" panel.
  - Mobile responsive throughout: stacked tabs, simplified table → list,
    grid collapses 4 cols → 3 → 2.
  - All colours use the WALLORA premium dark theme tokens
    (bg-background #0B0C0F, bg-surface, bg-raised, primary gold #D7B879,
    border-border, text-secondary-text, success, destructive). No blue /
    indigo / undefined warning tokens.

## Verification

- `bun run lint` → 0 errors / 0 warnings for all Phase 12 files.
- Dev server compiles all four admin routes successfully (no errors in
  `dev.log`); anonymous requests correctly return 401 from the
  `requireRole` guard, proving the server-side enforcement works.
- Internal curl smoke test:
  - `GET  /api/v1/admin/stats`                        → 401
  - `GET  /api/v1/admin/users`                        → 401
  - `GET  /api/v1/admin/wallpapers`                   → 401
  - `PATCH /api/v1/admin/wallpapers/test-id/moderate` → 401

## Integration note for the next phase

The component is not mounted into `src/app/page.tsx` because the task rules
prohibit modifying existing files. To wire the overlay in, add the following
one-liner alongside the other global panels in `src/app/page.tsx`:

```tsx
import { AdminPanel } from "@/components/landing/admin-panel";
// …inside the root fragment, next to <AiStudioPanel />:
<AdminPanel />
```

And add a "Admin Dashboard" entry inside `src/components/landing/user-menu.tsx`
that calls `useAdminPanel.getState().openAdmin()` (or the hook) — gated on
`user.role` being `admin` or `super_admin`. Both edits are tiny and confined
to existing files outside Phase 12's create-only scope.
