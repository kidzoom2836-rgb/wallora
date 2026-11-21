import { db } from "@/lib/db";

/**
 * WALLORA Sites — persisted as JSON in the existing StoredBlob table so no
 * Prisma migration is required. One blob per site plus a small slug index.
 */

export type SiteRecord = {
  id: string;
  ownerId: string;
  slug: string;
  title: string;
  prompt: string;
  html: string;
  published: boolean;
  externalPublished: boolean;
  forSale: boolean;
  priceCents: number;
  model: string;
  createdAt: string;
  updatedAt: string;
};

const PREFIX = "site:";
const SLUG_PREFIX = "site:slug:";

function key(id: string) {
  return `${PREFIX}${id}`;
}

function decode(data: Buffer): SiteRecord | null {
  try {
    return JSON.parse(data.toString("utf8")) as SiteRecord;
  } catch {
    return null;
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "site";
}

async function writeSite(site: SiteRecord) {
  const body = Buffer.from(JSON.stringify(site), "utf8");
  await db.storedBlob.upsert({
    where: { key: key(site.id) },
    update: { data: body, contentType: "application/json", size: body.length },
    create: { key: key(site.id), data: body, contentType: "application/json", size: body.length },
  });
}

export async function createSite(input: {
  ownerId: string;
  title: string;
  prompt: string;
  html: string;
  model: string;
}): Promise<SiteRecord> {
  const id = `site_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const base = slugify(input.title || input.prompt);
  const slug = `${base}-${id.slice(-6)}`;
  const now = new Date().toISOString();
  const site: SiteRecord = {
    id,
    ownerId: input.ownerId,
    slug,
    title: input.title || "Untitled site",
    prompt: input.prompt,
    html: input.html,
    published: false,
    externalPublished: false,
    forSale: false,
    priceCents: 0,
    model: input.model,
    createdAt: now,
    updatedAt: now,
  };
  await writeSite(site);
  const index = Buffer.from(id, "utf8");
  await db.storedBlob.upsert({
    where: { key: `${SLUG_PREFIX}${slug}` },
    update: { data: index, contentType: "text/plain", size: index.length },
    create: { key: `${SLUG_PREFIX}${slug}`, data: index, contentType: "text/plain", size: index.length },
  });
  return site;
}

export async function getSite(id: string): Promise<SiteRecord | null> {
  const blob = await db.storedBlob.findUnique({ where: { key: key(id) } });
  return blob ? decode(blob.data) : null;
}

export async function getSiteBySlug(slug: string): Promise<SiteRecord | null> {
  const index = await db.storedBlob.findUnique({ where: { key: `${SLUG_PREFIX}${slug}` } });
  if (!index) return null;
  return getSite(index.data.toString("utf8").trim());
}

export async function listSites(ownerId?: string): Promise<SiteRecord[]> {
  const blobs = await db.storedBlob.findMany({
    where: { key: { startsWith: PREFIX } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const sites = blobs.map((b) => decode(b.data)).filter((s): s is SiteRecord => !!s);
  return ownerId ? sites.filter((s) => s.ownerId === ownerId) : sites;
}

export async function listPublishedSites(): Promise<SiteRecord[]> {
  return (await listSites()).filter((s) => s.published);
}

export async function updateSite(
  id: string,
  patch: Partial<Omit<SiteRecord, "id" | "ownerId" | "slug" | "createdAt">>,
): Promise<SiteRecord | null> {
  const existing = await getSite(id);
  if (!existing) return null;
  const next: SiteRecord = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await writeSite(next);
  return next;
}

const PRO_KEY = "system:pro-users";

/** WALLORA Pro grants — stored as JSON so no schema change is needed. */
export async function listProUsers(): Promise<string[]> {
  const blob = await db.storedBlob.findUnique({ where: { key: PRO_KEY } });
  if (!blob) return [];
  try {
    const parsed = JSON.parse(blob.data.toString("utf8"));
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export async function setProUser(userId: string, enabled: boolean): Promise<string[]> {
  const current = await listProUsers();
  const next = enabled
    ? Array.from(new Set([...current, userId]))
    : current.filter((id) => id !== userId);
  const body = Buffer.from(JSON.stringify(next), "utf8");
  await db.storedBlob.upsert({
    where: { key: PRO_KEY },
    update: { data: body, contentType: "application/json", size: body.length },
    create: { key: PRO_KEY, data: body, contentType: "application/json", size: body.length },
  });
  return next;
}

export async function isPro(userId: string, role?: string): Promise<boolean> {
  if (role && ["admin", "moderator", "super_admin"].includes(role)) return true;
  return (await listProUsers()).includes(userId);
}

export async function deleteSite(id: string): Promise<SiteRecord | null> {
  const existing = await getSite(id);
  if (!existing) return null;
  await db.storedBlob.deleteMany({
    where: { key: { in: [key(id), `${SLUG_PREFIX}${existing.slug}`] } },
  });
  return existing;
}
