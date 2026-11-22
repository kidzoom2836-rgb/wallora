import { db } from "@/lib/db";

/**
 * Project showcase metadata — stored in StoredBlob so no Prisma migration is
 * needed. Core project fields (name, description, coverUrl, isPublic, assets,
 * notes) stay in the real CreativeProject tables; this adds the "proud of it"
 * layer: status, progress, milestones, target date and community shoutouts.
 */

export type ProjectStatus = "planning" | "in_progress" | "completed" | "archived";

export type ProjectMilestone = {
  id: string;
  title: string;
  done: boolean;
  completedAt: string | null;
};

export type ProjectMeta = {
  status: ProjectStatus;
  progress: number; // 0-100
  targetDate: string | null; // ISO date (YYYY-MM-DD)
  milestones: ProjectMilestone[];
};

export type ProjectShoutout = {
  userId: string;
  username: string | null;
  displayName: string | null;
  createdAt: string;
};

const META_KEY = "system:project-meta";
const SHOUTOUTS_KEY = "system:project-shoutouts";

export const DEFAULT_PROJECT_META: ProjectMeta = {
  status: "planning",
  progress: 0,
  targetDate: null,
  milestones: [],
};

async function read<T>(key: string, fallback: T): Promise<T> {
  const blob = await db.storedBlob.findUnique({ where: { key } });
  if (!blob) return fallback;
  try {
    return JSON.parse(Buffer.from(blob.data).toString("utf8")) as T;
  } catch {
    return fallback;
  }
}

async function write(key: string, value: unknown) {
  const data = Buffer.from(JSON.stringify(value), "utf8");
  await db.storedBlob.upsert({
    where: { key },
    update: { data, size: data.length, contentType: "application/json" },
    create: { key, data, size: data.length, contentType: "application/json" },
  });
}

export async function getProjectMeta(projectId: string): Promise<ProjectMeta> {
  const all = await read<Record<string, ProjectMeta>>(META_KEY, {});
  return { ...DEFAULT_PROJECT_META, ...(all[projectId] ?? {}) };
}

export async function getProjectMetas(
  ids: string[],
): Promise<Record<string, ProjectMeta>> {
  const all = await read<Record<string, ProjectMeta>>(META_KEY, {});
  const out: Record<string, ProjectMeta> = {};
  for (const id of new Set(ids)) {
    out[id] = { ...DEFAULT_PROJECT_META, ...(all[id] ?? {}) };
  }
  return out;
}

export async function setProjectMeta(
  projectId: string,
  patch: Partial<ProjectMeta>,
): Promise<ProjectMeta> {
  const all = await read<Record<string, ProjectMeta>>(META_KEY, {});
  const next: ProjectMeta = {
    ...DEFAULT_PROJECT_META,
    ...(all[projectId] ?? {}),
    ...patch,
  };
  if (typeof next.progress === "number") {
    next.progress = Math.max(0, Math.min(100, Math.round(next.progress)));
  }
  all[projectId] = next;
  await write(META_KEY, all);
  return next;
}

export async function deleteProjectMeta(projectId: string) {
  const all = await read<Record<string, ProjectMeta>>(META_KEY, {});
  if (projectId in all) {
    delete all[projectId];
    await write(META_KEY, all);
  }
  const shouts = await read<Record<string, ProjectShoutout[]>>(SHOUTOUTS_KEY, {});
  if (projectId in shouts) {
    delete shouts[projectId];
    await write(SHOUTOUTS_KEY, shouts);
  }
}

export async function getShoutouts(projectId: string): Promise<ProjectShoutout[]> {
  const all = await read<Record<string, ProjectShoutout[]>>(SHOUTOUTS_KEY, {});
  return all[projectId] ?? [];
}

export async function getShoutoutCounts(
  ids: string[],
): Promise<Record<string, number>> {
  const all = await read<Record<string, ProjectShoutout[]>>(SHOUTOUTS_KEY, {});
  const out: Record<string, number> = {};
  for (const id of new Set(ids)) out[id] = (all[id] ?? []).length;
  return out;
}

export async function toggleShoutout(
  projectId: string,
  user: { id: string; username: string | null; displayName: string | null },
): Promise<{ active: boolean; count: number }> {
  const all = await read<Record<string, ProjectShoutout[]>>(SHOUTOUTS_KEY, {});
  const list = all[projectId] ?? [];
  const idx = list.findIndex((s) => s.userId === user.id);
  let active: boolean;
  if (idx >= 0) {
    list.splice(idx, 1);
    active = false;
  } else {
    list.unshift({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      createdAt: new Date().toISOString(),
    });
    active = true;
  }
  all[projectId] = list;
  await write(SHOUTOUTS_KEY, all);
  return { active, count: list.length };
}
