import { db } from "@/lib/db";
import { getTiersForUsers, type VerificationTier } from "@/lib/verification/store";

/**
 * Showrooms — curated galleries with no Prisma migration.
 *
 * Each showroom lives in a single StoredBlob JSON document keyed by
 * `system:showroom:{username}`. Items only reference real records (approved
 * public wallpapers, public projects or a validated image URL) so the gallery
 * never renders dead links.
 */

export const EDITORS_USERNAME = "wallora-editors";
const SHOWROOM_PREFIX = "system:showroom:";
const MAX_ITEMS = 50;

export type ShowroomItem = {
  id: string;
  wallpaperSlug?: string | null;
  projectId?: string | null;
  imageUrl?: string | null;
  caption: string;
  createdAt: string;
};

export type Showroom = {
  username: string;
  headline: string;
  description: string;
  items: ShowroomItem[];
  updatedAt: string;
  /** Internal ownership marker — never sent to untrusted clients directly. */
  userId?: string | null;
};

export type ResolvedShowroomItem = {
  id: string;
  type: "wallpaper" | "project" | "image";
  title: string;
  imageUrl: string | null;
  href: string | null;
  /** Raw refs, so viewers can feature the same real work in their showroom. */
  wallpaperSlug?: string | null;
  projectId?: string | null;
  caption: string;
  createdAt: string;
};

export type ShowroomOwner = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  tier: VerificationTier;
  userId: string | null;
};

type RawShowroomInput = {
  id?: unknown;
  wallpaperSlug?: unknown;
  projectId?: unknown;
  imageUrl?: unknown;
  caption?: unknown;
  createdAt?: unknown;
};

function keyFor(username: string): string {
  return `${SHOWROOM_PREFIX}${normalizeUsername(username)}`;
}

export function normalizeUsername(username: unknown): string {
  return typeof username === "string" ? username.trim().toLowerCase() : "";
}

async function read<T>(key: string, fallback: T): Promise<T> {
  const blob = await db.storedBlob.findUnique({ where: { key } });
  if (!blob) return fallback;
  try {
    return JSON.parse(Buffer.from(blob.data).toString("utf8")) as T;
  } catch {
    return fallback;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  const data = Buffer.from(JSON.stringify(value), "utf8");
  await db.storedBlob.upsert({
    where: { key },
    update: { data, size: data.length, contentType: "application/json" },
    create: { key, data, size: data.length, contentType: "application/json" },
  });
}

function cleanString(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/** Only http(s) links and same-origin paths are safe to render. */
export function isSafeImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const url = value.trim();
  if (!url || url.length > 2048) return false;
  if (url.startsWith("//")) return false;
  if (url.startsWith("/")) return true;
  return /^https?:\/\//i.test(url);
}

function shortHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function idFor(ref: { wallpaperSlug?: string | null; projectId?: string | null; imageUrl?: string | null }): string {
  if (ref.wallpaperSlug) return `wp_${ref.wallpaperSlug}`;
  if (ref.projectId) return `pr_${ref.projectId}`;
  return `im_${shortHash(ref.imageUrl ?? "")}`;
}

function isOwner(showroom: Showroom | null, userId: string): boolean {
  if (!showroom) return true; // a new showroom can always be claimed by its creator
  return !showroom.userId || showroom.userId === userId;
}

/**
 * Validate raw item references against real data. Returns normalized items
 * ready for storage, or a human-readable error.
 */
export async function validateShowroomItems(
  raw: unknown,
  viewerUserId?: string,
): Promise<{ ok: true; items: ShowroomItem[] } | { ok: false; error: string }> {
  if (!Array.isArray(raw)) return { ok: false, error: "items must be an array." };
  if (raw.length > MAX_ITEMS) return { ok: false, error: `A showroom can hold at most ${MAX_ITEMS} items.` };

  const items: ShowroomItem[] = [];
  const seen = new Set<string>();

  for (const entry of raw as RawShowroomInput[]) {
    if (!entry || typeof entry !== "object") {
      return { ok: false, error: "Every item must be an object." };
    }
    const wallpaperSlug = cleanString(entry.wallpaperSlug, 200) || null;
    const projectId = cleanString(entry.projectId, 100) || null;
    const imageUrl = isSafeImageUrl(entry.imageUrl) ? entry.imageUrl.trim() : null;
    const refCount = [wallpaperSlug, projectId, imageUrl].filter(Boolean).length;
    if (refCount !== 1) {
      return { ok: false, error: "Each item needs exactly one of wallpaperSlug, projectId or imageUrl." };
    }

    let caption = cleanString(entry.caption, 200);
    let createdAt = cleanString(entry.createdAt, 40);

    if (wallpaperSlug) {
      const wallpaper = await db.wallpaper.findFirst({
        where: { slug: wallpaperSlug, status: "approved", isPublic: true },
        select: { slug: true, title: true, createdAt: true },
      });
      if (!wallpaper) return { ok: false, error: `Wallpaper "${wallpaperSlug}" is not available.` };
      caption = caption || wallpaper.title;
      createdAt = createdAt || wallpaper.createdAt.toISOString();
    } else if (projectId) {
      const project = await db.creativeProject.findFirst({
        where: {
          id: projectId,
          ...(viewerUserId
            ? { OR: [{ isPublic: true }, { userId: viewerUserId }] }
            : { isPublic: true }),
        },
        select: { id: true, name: true, createdAt: true },
      });
      if (!project) return { ok: false, error: "That project is not available." };
      caption = caption || project.name;
      createdAt = createdAt || project.createdAt.toISOString();
    } else {
      caption = caption || "Featured image";
      createdAt = createdAt || new Date().toISOString();
    }

    const id = cleanString(entry.id, 120) || idFor({ wallpaperSlug, projectId, imageUrl });
    if (seen.has(id)) continue; // duplicate refs are silently collapsed
    seen.add(id);

    items.push({
      id,
      wallpaperSlug,
      projectId,
      imageUrl,
      caption: caption || "Featured work",
      createdAt: createdAt || new Date().toISOString(),
    });
  }

  return { ok: true, items };
}

/** Resolve stored item refs to real titles, images and hrefs in two bulk reads. */
export async function resolveShowroomItems(items: ShowroomItem[]): Promise<ResolvedShowroomItem[]> {
  const slugs = items.map((i) => i.wallpaperSlug).filter((s): s is string => !!s);
  const projectIds = items.map((i) => i.projectId).filter((p): p is string => !!p);

  type WallpaperRow = { slug: string; title: string; assets: { variant: string; objectKey: string }[] };
  type ProjectRow = { id: string; name: string; coverUrl: string | null };

  const wallpaperPromise: Promise<WallpaperRow[]> = slugs.length
    ? db.wallpaper.findMany({
        where: { slug: { in: slugs }, status: "approved", isPublic: true },
        select: {
          slug: true,
          title: true,
          createdAt: true,
          assets: {
            where: { variant: { in: ["grid", "detail", "original"] } },
            select: { variant: true, objectKey: true },
            orderBy: { variant: "asc" },
          },
        },
      })
    : Promise.resolve([]);
  const projectPromise: Promise<ProjectRow[]> = projectIds.length
    ? db.creativeProject.findMany({
        where: { id: { in: projectIds }, isPublic: true },
        select: { id: true, name: true, coverUrl: true, createdAt: true },
      })
    : Promise.resolve([]);
  const [wallpapers, projects] = await Promise.all([wallpaperPromise, projectPromise]);

  const wallpaperBySlug = new Map<string, WallpaperRow>(wallpapers.map((w) => [w.slug, w]));
  const projectById = new Map<string, ProjectRow>(projects.map((p) => [p.id, p]));

  const resolved: ResolvedShowroomItem[] = [];
  for (const item of items) {
    if (item.wallpaperSlug) {
      const wallpaper = wallpaperBySlug.get(item.wallpaperSlug);
      if (!wallpaper) continue; // never surface a dead reference
      resolved.push({
        id: item.id,
        type: "wallpaper",
        title: wallpaper.title,
        imageUrl: wallpaper.assets.find((asset) => asset.variant === "grid")?.objectKey
          ?? wallpaper.assets[0]?.objectKey
          ?? null,
        href: `/wallpaper/${wallpaper.slug}`,
        wallpaperSlug: wallpaper.slug,
        projectId: null,
        caption: item.caption || wallpaper.title,
        createdAt: item.createdAt,
      });
    } else if (item.projectId) {
      const project = projectById.get(item.projectId);
      if (!project) continue;
      resolved.push({
        id: item.id,
        type: "project",
        title: project.name,
        imageUrl: project.coverUrl,
        href: `/projects/${project.id}`,
        wallpaperSlug: null,
        projectId: project.id,
        caption: item.caption || project.name,
        createdAt: item.createdAt,
      });
    } else if (isSafeImageUrl(item.imageUrl)) {
      resolved.push({
        id: item.id,
        type: "image",
        title: item.caption || "Featured image",
        imageUrl: item.imageUrl,
        href: item.imageUrl,
        wallpaperSlug: null,
        projectId: null,
        caption: item.caption || "Featured image",
        createdAt: item.createdAt,
      });
    }
  }
  return resolved;
}

/** Owner snapshots for a batch of showrooms — one profile scan + one tier read. */
export async function getShowroomOwners(usernames: string[]): Promise<Record<string, ShowroomOwner>> {
  const unique = [...new Set(usernames.filter(Boolean))];
  if (unique.length === 0) return {};

  const profiles = await db.profile.findMany({
    where: { username: { in: unique } },
    select: {
      username: true,
      displayName: true,
      avatarUrl: true,
      userId: true,
    },
  });
  const tiers = await getTiersForUsers(profiles.map((p) => p.userId));
  const out: Record<string, ShowroomOwner> = {};
  for (const name of unique) {
    const profile = profiles.find((p) => p.username === name);
    if (profile) {
      out[name] = {
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        tier: tiers[profile.userId] ?? "free",
        userId: profile.userId,
      };
    } else if (name === EDITORS_USERNAME) {
      out[name] = {
        username: name,
        displayName: "WALLORA Editors",
        avatarUrl: null,
        tier: "premium",
        userId: null,
      };
    }
  }
  return out;
}

export type ShowroomPayload = {
  username: string;
  headline: string;
  description: string;
  updatedAt: string;
  itemCount: number;
  owner: ShowroomOwner;
  items: ResolvedShowroomItem[];
};

/**
 * Build public payloads for one or many showrooms. Owner snapshots are
 * resolved in one profile read + one tier read, and all item references are
 * resolved in two bulk queries — no N+1 calls.
 */
export async function buildShowroomPayloads(
  showrooms: Showroom[],
  itemLimit?: number,
): Promise<ShowroomPayload[]> {
  if (showrooms.length === 0) return [];
  const owners = await getShowroomOwners(showrooms.map((s) => s.username));

  const allItems = showrooms.flatMap((showroom) => showroom.items);
  const resolved = await resolveShowroomItems(allItems);
  const byId = new Map(resolved.map((item) => [item.id, item]));

  return showrooms.flatMap((showroom) => {
    const owner = owners[showroom.username];
    if (!owner) return []; // owner profile was removed — never show an orphan card
    const visible = showroom.items
      .map((item) => byId.get(item.id))
      .filter((item): item is ResolvedShowroomItem => !!item);
    return [{
      username: showroom.username,
      headline: showroom.headline,
      description: showroom.description,
      updatedAt: showroom.updatedAt,
      itemCount: visible.length,
      owner,
      items: typeof itemLimit === "number" ? visible.slice(0, itemLimit) : visible,
    }];
  });
}

/** Seed a real, curated editors showroom once so the gallery is never blank. */
export async function seedEditorsShowroom(): Promise<void> {
  const key = keyFor(EDITORS_USERNAME);
  const existing = await db.storedBlob.findUnique({ where: { key }, select: { key: true } });
  if (existing) return;

  const wallpapers = await db.wallpaper.findMany({
    where: { status: "approved", isPublic: true },
    orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
    take: 8,
    select: {
      slug: true,
      title: true,
      createdAt: true,
      assets: {
        where: { variant: { in: ["grid", "detail", "original"] } },
        select: { variant: true, objectKey: true },
        orderBy: { variant: "asc" },
      },
    },
  });

  const items: ShowroomItem[] = wallpapers
    .filter((w) => !!w.assets[0]?.objectKey)
    .map((w) => ({
      id: `wp_${w.slug}`,
      wallpaperSlug: w.slug,
      projectId: null,
      imageUrl: null,
      caption: w.title,
      createdAt: w.createdAt.toISOString(),
    }));

  if (items.length === 0) {
    const projects = await db.creativeProject.findMany({
      where: { isPublic: true, coverUrl: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, name: true, coverUrl: true, createdAt: true },
    });
    for (const project of projects) {
      if (!isSafeImageUrl(project.coverUrl)) continue;
      items.push({
        id: `pr_${project.id}`,
        wallpaperSlug: null,
        projectId: project.id,
        imageUrl: null,
        caption: project.name,
        createdAt: project.createdAt.toISOString(),
      });
    }
  }

  await write(key, {
    username: EDITORS_USERNAME,
    headline: "WALLORA Editors",
    description: "A hand-picked edit of real, approved work from the WALLORA community.",
    items,
    updatedAt: new Date().toISOString(),
    userId: null,
  } satisfies Showroom);
}

export async function getShowroom(username: string): Promise<Showroom | null> {
  const name = normalizeUsername(username);
  if (!name) return null;
  if (name === EDITORS_USERNAME) await seedEditorsShowroom();
  const showroom = await read<Showroom | null>(keyFor(name), null);
  return showroom && showroom.username === name ? showroom : null;
}

/** List every showroom, seeding the editors gallery before the first read. */
export async function listShowrooms(): Promise<Showroom[]> {
  await seedEditorsShowroom();
  const blobs = await db.storedBlob.findMany({
    where: { key: { startsWith: SHOWROOM_PREFIX } },
    select: { key: true, data: true },
  });

  const out: Showroom[] = [];
  for (const blob of blobs) {
    try {
      const value = JSON.parse(Buffer.from(blob.data).toString("utf8")) as Showroom;
      if (value && typeof value.username === "string" && Array.isArray(value.items)) {
        out.push(value);
      }
    } catch {
      // Ignore corrupt blobs rather than breaking the whole gallery.
    }
  }
  return out.sort((a, b) => {
    if (a.username === EDITORS_USERNAME) return -1;
    if (b.username === EDITORS_USERNAME) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export async function upsertShowroom(
  userId: string,
  username: string,
  data: { headline?: string; description?: string; items?: ShowroomItem[] },
): Promise<Showroom | null> {
  const name = normalizeUsername(username);
  if (!name) return null;
  const key = keyFor(name);
  const existing = await read<Showroom | null>(key, null);
  if (!isOwner(existing, userId)) return null;

  const next: Showroom = {
    username: name,
    headline: cleanString(data.headline, 120) || existing?.headline || "My WALLORA showroom",
    description: cleanString(data.description, 1000) || existing?.description || "Work I keep coming back to.",
    items: (data.items ?? existing?.items ?? []).slice(0, MAX_ITEMS),
    updatedAt: new Date().toISOString(),
    userId,
  };
  await write(key, next);
  return next;
}

export async function addShowroomItem(
  userId: string,
  username: string,
  item: ShowroomItem,
): Promise<Showroom | null> {
  const name = normalizeUsername(username);
  if (!name) return null;
  let showroom = await getShowroom(name);
  if (!isOwner(showroom, userId)) return null;
  if (!showroom) {
    showroom = await upsertShowroom(userId, name, { items: [] });
    if (!showroom) return null;
  }
  if (showroom.items.some((existing) => existing.id === item.id)) return showroom;

  const next: Showroom = {
    ...showroom,
    items: [item, ...showroom.items].slice(0, MAX_ITEMS),
    updatedAt: new Date().toISOString(),
  };
  await write(keyFor(name), next);
  return next;
}

export async function removeShowroomItem(
  userId: string,
  username: string,
  itemId: string,
): Promise<Showroom | null> {
  const name = normalizeUsername(username);
  if (!name) return null;
  const showroom = await getShowroom(name);
  if (!isOwner(showroom, userId) || !showroom) return null;
  const items = showroom.items.filter((item) => item.id !== itemId);
  if (items.length === showroom.items.length) return showroom;

  const next: Showroom = { ...showroom, items, updatedAt: new Date().toISOString() };
  await write(keyFor(name), next);
  return next;
}
