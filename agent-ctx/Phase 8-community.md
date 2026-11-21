# Phase 8 — Community Feature (Follows + Comments)

**Task ID**: Phase 8
**Agent**: fullstack-dev (community feature)
**Status**: Completed

## Summary

Implemented the WALLORA Community feature (Phase 8): user-follow relationships
and wallpaper comments. All files are new — no existing files were modified.

## Files Created

### API Routes

1. `src/app/api/v1/users/[username]/follow/route.ts`
   - **POST**: Follow a user (auth required). Resolves target by Profile.username.
     Rejects self-follow with 400. Idempotent — returns `{ following: true }`
     even if the follow already exists.
   - **DELETE**: Unfollow (auth required). Uses `deleteMany` for idempotent
     removal. Returns `{ following: false }`.

2. `src/app/api/v1/users/[username]/route.ts`
   - **GET**: Public profile by username. Returns profile fields, stats
     (`followers`, `following`, `wallpapers` count — only approved+public
     wallpapers counted), `isFollowing` (viewer-aware), and `isSelf`.
   - Only returns the user when `user.status === "active"`; 404 otherwise.

3. `src/app/api/v1/wallpapers/[slug]/comments/route.ts`
   - **GET**: Public comment list (newest-first, 50 cap). Each comment includes
     author snapshot (id, username, displayName, avatarUrl, verified).
   - **POST**: Auth-required. Body validated by Zod (`content` 1–500 chars).
     Returns 201 with the created comment + author snapshot.

### UI Components

4. `src/components/landing/comments-section.tsx`
   - `"use client"` component driven by TanStack Query.
   - Fetches `GET /api/v1/wallpapers/[slug]/comments` (queryKey
     `["wallpaper-comments", slug]`, staleTime 15s).
   - Composer is auth-aware: signed-out visitors see a "Sign in to comment"
     button wired to `useAuthDialog().openSignIn`.
   - Posting uses `useMutation` with **optimistic prepend** (local entry with
     `optimistic-` id), snapshot-based rollback on error, and replacement with
     the real server comment on success.
   - List items render avatar initials, displayName, @username, verified badge,
     relative time (`date-fns` `formatDistanceToNowStrict`), and content.
   - Loading skeleton, error state, and empty state included.
   - Premium dark theme: `bg-surface`, `border-border`, `text-primary` gold
     accents.

5. `src/components/landing/follow-button.tsx`
   - `"use client"` pill-shaped toggle button.
   - Props: `{ username, initialFollowing, isSelf?, size?, className? }`.
   - Auth-aware: signed-out click opens the auth dialog.
   - Uses `useMutation` to POST/DELETE `/api/v1/users/[username]/follow` with
     optimistic flip and revert-on-error.
   - Renders `Follow` (gold) / `Following` (outline) variants with `UserPlus`
     / `UserCheck` icons. Hidden when `isSelf` is true.
   - Compact sizing so it fits the wallpaper detail dialog's creator row.

## Patterns Used

- Auth: `requireUser()` / `getAuthSession()` from `@/lib/auth-helpers`.
- DB: `db` from `@/lib/db`.
- Error envelope: `{ error: { code, message } }`. Success envelope: `{ data }`.
- Routes use `params: Promise<{ ... }>` (Next.js 16 async params pattern).
- Zod for POST validation.
- Premium dark theme tokens (`bg-background`, `bg-surface`, `text-foreground`,
  `text-secondary-text`, `border-border`, `bg-primary text-primary-foreground`).

## Self-Follow Prevention

`follow/route.ts` returns `400` with `code: "invalid_request"` when
`followerId === followingId`. UI also hides the button when `isSelf` is true.

## Idempotency

- Follow POST: checks `follow.findUnique` on the composite unique key
  (`followerId_followingId`) before create; try/catch around create to absorb
  race-condition collisions.
- Follow DELETE: uses `deleteMany` — no-op when row doesn't exist.
- Comments: append-only (no idempotency needed; optimistic entry replaced by
  real one on success).

## Lint

`bun run lint` — passes with no errors or warnings for the new files.

## Integration Notes for Later Phases

- `FollowButton` is ready to drop into `wallpaper-detail-dialog.tsx` next to
  the creator chip. The detail dialog already has `creator.username`; wire
  `initialFollowing` via a `useQuery` on `/api/v1/users/[username]` (or extend
  the wallpaper detail response to include `isFollowing`).
- `CommentsSection` accepts a `slug` prop and is ready to drop into the bottom
  of the detail dialog sidebar.
