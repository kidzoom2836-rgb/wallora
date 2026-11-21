# Phase 9 — Marketplace (products & purchases)

**Task ID:** Phase 9
**Agent:** z-ai-code
**Status:** Complete

## Summary

Built the WALLORA Marketplace feature (Phase 9): seeded real Product rows from
the curator's approved wallpapers, shipped three API endpoints (list, detail,
purchase), and built a premium dark-theme UI grid with a detail dialog and an
honest demo purchase flow.

No existing files were modified. Only new files were created, per the task
rules.

## Files created

### 1. Seed script
- `prisma/seed-marketplace.ts`
  - Finds the curator user (`curated@wallora.io`).
  - Loads their approved wallpapers with grid/original/detail assets.
  - Creates 5 Product rows with varied prices (0, 499, 999, 1499, 799 cents).
  - Pulls coverUrl from each wallpaper's grid asset.
  - License set to `"WALLORA Showcase"` for all 5.
  - Idempotent: skips products whose (creatorId, title) already exists.
  - Run with: `bun run prisma/seed-marketplace.ts`.
  - Imports `db` from `../src/lib/db` (relative, as required).

### 2. API routes (under `src/app/api/v1/`)
- `products/route.ts` — GET list of published products.
  - Paginated (page, limit max 24).
  - Filter by `creator` (username).
  - Includes creator profile (username, displayName, verified) and the live
    completed-purchase count.
  - Sorted by `createdAt` desc.
  - Response shape: `{ data: { items, pagination } }`.
- `products/[id]/route.ts` — GET single product detail.
  - Returns full details + creator profile + purchase count.
  - Auth-aware: if the session user owns the product, includes `owned: true`
    and the user's purchase record.
  - 404 if not found or not published.
- `products/[id]/purchase/route.ts` — POST purchase (auth required).
  - `requireUser()` for auth; 401 if no session.
  - 404 if product missing or unpublished.
  - 409 if the user is the creator (cannot self-purchase).
  - Idempotent: if the user already has a Purchase for this product (any
    status), returns 200 with `alreadyOwned: true` and the existing row.
  - Otherwise creates a Purchase at `status="completed"` and returns 201.
  - Every response carries a `demo` block with `note` and `paymentProvider: null`
    — honest about the absence of a real payment gateway.

### 3. UI component
- `src/components/landing/marketplace-grid.tsx`
  - `"use client"` component.
  - TanStack Query: fetches `GET /api/v1/products?limit=12`.
  - Responsive grid: 1 col mobile, 2 cols tablet, 3 cols desktop.
  - Each card: cover image (4:3), title, creator avatar initial + name +
    verified badge, price formatted (`$X.XX` or `Free`), license badge,
    purchase count, hover affordance.
  - Clicking a card opens a Dialog (shadcn/ui) showing the large cover,
    title, description, creator info, price block, license metadata,
    "Purchase" button.
  - Purchase button: auth-aware — opens the auth dialog via the existing
    `useAuthDialog` store if not signed in; otherwise calls
    `POST /api/v1/products/[id]/purchase`.
  - On success: success toast via `sonner`, refetches both the detail query
    (to flip `owned`) and the list query (to update purchase counts).
  - If already owned: renders an "In your library" state instead of the
    purchase button.
  - Includes an explicit "Demo purchase flow" notice in the dialog.
  - Loading skeleton grid, empty state, error state with retry.
  - Framer Motion entrance animations on cards.
  - Premium dark theme tokens: `bg-background`, `bg-surface`, `border-border`,
    `text-foreground`, `text-secondary-text`, `text-primary` (gold).

## Verification

### Seed
- `bun run prisma/seed-marketplace.ts` — first run created 5 products.
- Second run was idempotent: "5 skipped, 0 created, 5 total".

### API endpoints (curl)
- `GET /api/v1/products?limit=12` → 200, returns 5 items with creator profile +
  purchaseCount, pagination block.
- `GET /api/v1/products?creator=wallora` → 200, 5 items, total=5.
- `GET /api/v1/products?creator=doesnotexist` → 200, 0 items, total=0.
- `GET /api/v1/products/{id}` → 200, full detail + `owned` flag flips based on
  session.
- `GET /api/v1/products/nonexistent-id` → 404 `{ error: { code: "not_found", ... } }`.
- `POST /api/v1/products/{id}/purchase` (no session) → 401.
- `POST /api/v1/products/{id}/purchase` (authed, first time) → 201,
  `status="completed"`, `alreadyOwned: false`, demo note present.
- `POST /api/v1/products/{id}/purchase` (authed, second time) → 200,
  `alreadyOwned: true`, same purchase id (idempotent).
- `POST /api/v1/products/{paidId}/purchase` (authed) → 201 with `price: 499`.

### Lint & types
- `bun run lint` → 0 errors, 0 warnings in any of the new files.
- `npx tsc --noEmit` → no errors reported for any of the new files.

### Dev log
- All endpoint requests return 200/201 cleanly with no compile errors.

## Notes / handoff

- The `MarketplaceGrid` component is created but NOT wired into `src/app/page.tsx`
  because the task rules forbid modifying existing files. To surface it on the
  landing page, a future agent (or the user) can add
  `<MarketplaceGrid />` to `page.tsx` next to (or replacing) the existing
  `MarketplacePreview` section.
- The existing `MarketplacePreview` section says "Launches in Phase 9" — that
  copy is now stale; it should be updated when wiring the grid in.
- The purchase flow is intentionally honest about being a demo. The response
  always includes `demo.paymentProvider: null` and a human-readable note. The
  UI surfaces this in a dedicated notice block in the detail dialog.
- Prices are stored as Int cents and formatted client-side with
  `formatPrice()` (0 → "Free", 499 → "$4.99", 999 → "$9.99").
- The schema models `Product` and `Purchase` were already defined in
  `prisma/schema.prisma` and were NOT modified.
