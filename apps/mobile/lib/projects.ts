export type ProjectStatus = "planning" | "in_progress" | "completed" | "archived";

export type ProjectMilestone = {
  id: string;
  title: string;
  done: boolean;
  completedAt: string | null;
};

export type ProjectMeta = {
  status: ProjectStatus;
  progress: number;
  targetDate: string | null;
  milestones: ProjectMilestone[];
};

export type ProjectAsset = {
  id: string;
  assetType: "wallpaper" | "generation";
  wallpaperId: string | null;
  generationId: string | null;
  note: string | null;
  createdAt: string;
  wallpaper: {
    id: string;
    slug: string;
    title: string;
    orientation: string;
    dominantColor: string | null;
    gridAsset: { objectKey: string; width: number; height: number } | null;
  } | null;
  generation: {
    id: string;
    prompt: string;
    publicUrl: string | null;
    width: number;
    height: number;
    aspectRatio: string;
  } | null;
};

export type ProjectNote = {
  id: string;
  content: string;
  createdAt: string;
};

export type ProjectDetail = {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  assets: ProjectAsset[];
  notes: ProjectNote[];
  meta: ProjectMeta;
};

export type PublicProject = {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
  assets: ProjectAsset[];
  notes: ProjectNote[];
  meta: ProjectMeta;
  shoutouts: {
    userId: string;
    username: string | null;
    displayName: string | null;
    createdAt: string;
  }[];
  owner: {
    id: string;
    username: string | null;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    verified: boolean;
    tier: "free" | "verified" | "premium";
  };
};

export type CatalogWallpaper = {
  id: string;
  title: string;
  orientation: string;
  assets?: { variant: string; objectKey: string }[];
  gridAsset?: { objectKey: string; width: number; height: number } | null;
};

export type CatalogGeneration = {
  id: string;
  prompt: string;
  status: string;
  publicUrl: string | null;
  aspectRatio: string;
};

export const DEFAULT_META: ProjectMeta = {
  status: "planning",
  progress: 0,
  targetDate: null,
  milestones: [],
};

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  in_progress: "In progress",
  completed: "Completed",
  archived: "Archived",
};

export function assetImage(asset: ProjectAsset): string | null {
  return asset.assetType === "generation"
    ? asset.generation?.publicUrl ?? null
    : asset.wallpaper?.gridAsset?.objectKey ?? null;
}

export function coverImage(project: {
  coverUrl?: string | null;
  assets?: ProjectAsset[];
}): string | null {
  if (project.coverUrl) return project.coverUrl;
  for (const asset of project.assets ?? []) {
    const image = assetImage(asset);
    if (image) return image;
  }
  return null;
}

export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
