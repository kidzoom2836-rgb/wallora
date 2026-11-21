# Upload Page + UI Refactor — Work Record

## Task ID: 2
Build the WALLORA upload page (`/upload`) as the primary deliverable, plus
refactor three existing components to use the custom SVG icon system instead
of `lucide-react` and to capture the receive-endpoint key (Blob support).

## Files touched

### 1. CREATED — `src/app/(app)/upload/page.tsx` (primary deliverable)
A dedicated, client-side upload page that inherits the `(app)` layout's
`AppHeader`. Implements the full multi-step state machine
`select → metadata → uploading → result → error`.

**Layout**: `max-w-4xl` centered container, `py-12`, with a `font-display`
heading "Upload a wallpaper" + subtitle. On `lg:` screens a 5-column grid
(3:2) — left side hosts the drop zone / preview, right side hosts the
metadata form (or pipeline explainer during the select step).

**State machine**
- **select**: large dashed-border drag-drop zone (`border-border` →
  `hover:border-primary/40`, drag-active `border-primary`). Gold circle with
  `UploadIcon`, "Drop an image here / or click to browse". Accepts JPEG / PNG
  / WebP, ≤ 10 MB, ≥ 512×512 (dimensions validated by loading the file into an
  `Image()` before transitioning). Auto-fills the title from the filename.
  Right rail shows a 4-step "What happens next" pipeline explainer.
- **metadata**: two-column grid — left: square preview thumbnail + file
  name + size + type in a card with a circular `CloseIcon` remove button;
  right: form (`Title` Input required, `Category` Select required, fetched
  from `/api/v1/categories` via `useQuery` enabled on this step, optional
  `Description` Textarea, optional comma-separated `Tags` Input with a
  `TagIcon` affordance). Buttons: `Cancel` (ghost, resets), `Upload &
  process` (gold primary, disabled until valid).
- **uploading**: centered spinning `LoaderIcon` in a gold circle + custom
  progress bar (0 → 100%) + rotating status text (`"Uploading…"`,
  `"Processing variants…"`, `"Finalizing…"`) + helper copy.
- **result**: `CheckCircleIcon` in a success circle, wallpaper title, a
  `Pending review` gold-outline badge, the grid-variant preview, and a 2×2
  info-card grid (Status / Variants count / Orientation / Dominant color
  with a color swatch). Buttons: `Close` (links to `/discover`), `Upload
  another` (resets).
- **error**: `AlertIcon` in a destructive circle, the error message,
  `Close` (links to `/discover`) + `Try again` (back to metadata if a file
  is still selected, else reset).

**Upload mutation** (`useMutation` from `@tanstack/react-query`):
1. `POST /api/v1/uploads/presign` with `{ filename, contentType, size }` →
   `{ data: { key, uploadUrl, fields } }`. Progress → 15%.
2. `POST` the file to `uploadUrl` as multipart FormData (all `fields` plus
   the `file`). Captures the returned key as `effectiveKey = uploadData.data?.key ?? key`
   so the Blob adapter's public-URL key is propagated correctly. Progress → 45%.
3. `POST /api/v1/uploads/complete` with `{ key: effectiveKey, filename, title,
   categoryId, description, tags }` → returns `UploadResult`. Progress → 70%
   before the request, → 100% on success.

`onSuccess` sets the result + transitions to `result` + fires a sonner
success toast. `onError` sets the error + transitions to `error` + fires a
sonner error toast.

**Auth gate**: `useSession()` — `status === "loading"` shows a centered
spinning `LoaderIcon`; `status !== "authenticated"` shows a centered
`SignInGate` card ("Sign in to upload") with `Sign in` + `Create account`
links (both with `?callbackUrl=/upload`).

**Icons used**: `UploadIcon`, `ImageIcon`, `CheckCircleIcon`, `AlertIcon`,
`CloseIcon`, `PlusIcon`, `LoaderIcon`, `ArrowRightIcon`, `SparklesIcon`,
`TagIcon` — all from `@/components/icons/wallora-icons`. Zero `lucide-react`
imports.

### 2. MODIFIED — `src/components/landing/app-header.tsx`
- Added `UploadIcon` to the wallora-icons import.
- Inserted `{ href: "/upload", label: "Upload", icon: UploadIcon }` as the
  FIRST entry in `NAV_LINKS` (before Discover). Active-state logic
  (`pathname === link.href || pathname.startsWith(link.href + "/")`) was
  already correct and now matches `/upload`.

### 3. MODIFIED — `src/components/landing/my-uploads.tsx`
- Removed the `import { UploadCloud, Clock, CheckCircle2, XCircle, ImageIcon, Eye, Heart, Download } from "lucide-react"` line entirely.
- Removed the `useUploadDialog` import + its usage in the component.
- Imported `UploadIcon, CheckCircleIcon, AlertIcon, ImageIcon, EyeIcon, HeartIcon, DownloadIcon` from `@/components/icons/wallora-icons`.
- Added `Link` from `next/link`.
- Updated `STATUS_CONFIG` icon types: pending → `UploadIcon`, approved →
  `CheckCircleIcon`, rejected + flagged → `AlertIcon`. The type of `icon` was
  updated from `typeof Clock` to `typeof UploadIcon`.
- Replaced every lucide usage with the wallora equivalent (`size={N}` prop
  instead of `h-N w-N` classes).
- Both "Upload wallpaper" buttons now use `<Button asChild><Link href="/upload">…</Link></Button>` instead of `onClick={() => openUpload()}`.
- Grid layout, motion animations, and data fetching (`useQuery(["my-wallpapers"]`)
  are unchanged.

### 4. MODIFIED — `src/components/landing/upload-dialog.tsx`
- Removed the `import { UploadCloud, Loader2, CheckCircle2, AlertCircle, ImageIcon, X, Plus } from "lucide-react"` line entirely.
- Removed `useSession` import (the `session` value was never used in the body).
- Imported `UploadIcon, LoaderIcon, CheckCircleIcon, AlertIcon, CloseIcon, PlusIcon` from `@/components/icons/wallora-icons`.
- Replaced every lucide usage with the wallora equivalent.
- **Fixed the upload pipeline** to capture the effective key from the receive
  endpoint: after `await fetch(uploadUrl, { method: "POST", body: formData })`,
  we now do `const uploadData = await uploadRes.json(); const effectiveKey = uploadData.data?.key ?? key;`
  and pass `effectiveKey` (not `key`) to `/api/v1/uploads/complete`. For the
  Blob adapter the receive endpoint returns the public URL as `key`, which is
  the value downstream code expects to persist.
- Consolidated the per-adapter branching — the same multipart FormData POST
  works for local, blob, and R2 adapters (R2's presigned POST also accepts
  the same multipart shape).
- Progress milestones updated to the agreed checkpoints: 15% after presign,
  45% after upload, 70% before complete, 100% on success.
- Removed the unused `adapterType` destructuring.
- Dialog still opens/closes via the `useUploadDialog` store, the result
  step still shows the moderation badge + grid preview + info cards, and
  the error step still offers Close / Try again.

## Lint verification
`bun run lint` exits 0 (clean). The project's ESLint config disables
`@typescript-eslint/no-unused-vars` so the pre-existing unused `refetch`
in `my-uploads.tsx` (which was there before this task) is not flagged.

## API routes
Not modified — `/api/v1/uploads/presign`, `/api/v1/uploads/receive`,
`/api/v1/uploads/complete`, and `/api/v1/categories` were already correct
for both the local and Blob storage adapters.

## Notes for downstream agents
- The shared `AppHeader` already exposes `/upload` as a nav link — no
  additional routing work is needed.
- The upload pipeline depends on the storage adapter configured at runtime:
  in this dev environment (no `BLOB_READ_WRITE_TOKEN` / `R2_*` env), the
  local adapter is selected and `effectiveKey === key` (a
  `w/{userId}/...` path). For Vercel Blob deployments, `effectiveKey` is
  the public Blob URL returned by `/api/v1/uploads/receive`.
- The `useUploadDialog` store + `<UploadDialog>` modal are still mounted
  in the authenticated landing experience; they were not removed because
  the task scoped changes to the dialog's internals only.
