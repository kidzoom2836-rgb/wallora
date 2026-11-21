# Projects Page — Work Record

## Task
Create a dedicated Projects PAGE (not an overlay panel) at
`src/app/(app)/projects/page.tsx` inside the `(app)` route group, which shares
a layout with a 4rem sticky header.

## What was built
A single client component (`ProjectsPage`) plus helper subcomponents, all in
one file. No existing files were modified.

### Layout
- Root: `h-[calc(100vh-4rem)] flex overflow-hidden` (accounts for the shared
  4rem header from `(app)/layout.tsx`).
- Left sidebar (`w-72`, hidden on mobile via `md:flex`): sidebar header,
  "New project" button, scrollable project list with hover-revealed delete.
- Main area (`flex-1 flex flex-col overflow-hidden`):
  - Mobile top bar with back navigation + "New" button.
  - Scrollable body (`max-w-5xl`): empty state / new-project form / project
    detail (header card + assets grid + notes section).
- Mobile: when no project is selected, an inline project picker renders inside
  the main area so mobile users can still browse/select/create.

### Data fetching (TanStack Query)
- `useQuery(["projects"])` → `GET /api/v1/projects` (list with counts).
- `useQuery(["project", id])` → `GET /api/v1/projects/[id]` (detail w/ assets +
  notes), `enabled: !!selectedId`.
- `useMutation` for create (`POST /api/v1/projects`), delete
  (`DELETE /api/v1/projects/[id]`), add note
  (`POST /api/v1/projects/[id]/notes`). Each invalidates the relevant query
  keys and surfaces `sonner` toasts.

### Auth
- `useSession()` from `next-auth/react`.
- `status === "loading"` → centered spinner.
- `status !== "authenticated"` → "Sign in to view your projects" with a
  `<Link href="/">` styled button.

### Icons
All icons imported only from `@/components/icons/wallora-icons` (no
lucide-react): `PlusIcon, TrashIcon, FolderIcon, LoaderIcon, ImageIcon,
SparklesIcon, ArrowLeftIcon, SendIcon`. LoaderIcon spinners use inline
`style={{ animation: "spin 1s linear infinite" }}` (same pattern as the AI
page).

### shadcn/ui components used
`Button`, `Input`, `Textarea`, `Badge` — all pre-existing in
`src/components/ui`.

### Theme
Premium dark tokens from `globals.css`: `bg-background`, `bg-surface`,
`bg-raised`, `border-border`, `text-foreground`, `text-secondary-text`,
`text-primary` / `bg-primary` / `text-primary-foreground`, `text-destructive`,
`text-success`. No indigo/blue.

## Verification
- `bun run lint` → 0 errors, 0 warnings.
- Dev server log shows healthy compilation; no errors related to the new route.

## Files touched
- Created: `src/app/(app)/projects/page.tsx`
- Modified: none
- Packages installed: none
