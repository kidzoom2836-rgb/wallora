# Vercel deployment

The WALLORA repo is a pnpm monorepo. The Next.js app lives in `apps/web`; the repo
root only contains workspace tooling. Vercel must therefore be pointed at the web
app instead of the repository root.

## Fix for `NEXT_NO_VERSION`

If a build log says:

```text
[NEXT_NO_VERSION] No Next.js version detected. Make sure your package.json has
"next" in either "dependencies" or "devDependencies". Also check your Root
Directory setting matches the directory of your package.json file.
```

open the Vercel project settings and set:

- **Root Directory:** `apps/web`
- **Include files outside the root directory in the Build Step:** keep ON
  (the `@wallora/*` workspace packages live outside `apps/web`)
- **Framework Preset:** `Next.js`
- **Build Command:** leave override OFF, or use `pnpm build`
- **Output Directory:** leave override OFF, or use `.next`
- **Install Command:** leave default (`pnpm install`)

Save, then redeploy. Do not add `next` to the root `package.json`; that masks the
configuration problem and creates version drift. A repo-level `vercel.json` is not
a substitute for the Root Directory setting because Vercel resolves the Next.js
version from the configured root.

Required build-time environment variables in the Vercel project:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `NVIDIA_API_KEY`
- `PIXABAY_API_KEY` (admin wallpaper importer and Reels proxy)
- `YOUTUBE_API_KEY` and `PEXELS_API_KEY` (server-only Reels providers)

Never add provider keys as `EXPO_PUBLIC_*` or `NEXT_PUBLIC_*` variables; those values are embedded
in client bundles. The mobile app calls `/api/v1/reels/search` and receives only video metadata.
