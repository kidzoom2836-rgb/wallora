import { db } from "@/lib/db";
import { getTiersForUsers, type VerificationTier } from "@/lib/verification/store";

/**
 * Community feed storage.
 *
 * Everything lives in StoredBlob JSON so the feature needs no Prisma migration.
 * Posts hold denormalised counters; membership sets (likes / reposts) live in
 * their own blobs so each interaction is idempotent per user.
 */

const POSTS_KEY = "system:community-posts";
const LIKES_KEY = "system:community-likes";
const REPOSTS_KEY = "system:community-reposts";
const COMMENTS_KEY = "system:community-comments";
const SHARES_KEY = "system:community-shares";

export type CommunityTier = VerificationTier;

export type AuthorSnapshot = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  tier: CommunityTier;
};

type StoredAuthor = Omit<AuthorSnapshot, "tier"> & { tier?: CommunityTier };

export type PostKind = "text" | "wallpaper" | "project";

export type RepostPreview = {
  id: string;
  author: AuthorSnapshot;
  body: string;
};

type StoredRepostPreview = {
  id: string;
  author: StoredAuthor;
  body: string;
};

export type StoredPost = {
  id: string;
  author: StoredAuthor;
  body: string;
  kind: PostKind;
  refId: string | null;
  imageUrl: string | null;
  repostOf: StoredRepostPreview | null;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  shareCount: number;
  createdAt: string;
};

export type CommunityPost = {
  id: string;
  author: AuthorSnapshot;
  body: string;
  kind: PostKind;
  refId: string | null;
  imageUrl: string | null;
  repostOf: RepostPreview | null;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  shareCount: number;
  liked: boolean;
  reposted: boolean;
  createdAt: string;
};

export type StoredComment = {
  id: string;
  postId: string;
  author: StoredAuthor;
  content: string;
  createdAt: string;
};

export type CommunityComment = {
  id: string;
  postId: string;
  author: AuthorSnapshot;
  content: string;
  createdAt: string;
};

export type FeedPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type FeedSort = "recent" | "popular";

const SYSTEM_AUTHOR: AuthorSnapshot = {
  id: "system",
  username: "wallora",
  displayName: "WALLORA",
  avatarUrl: null,
  tier: "verified",
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

async function write(key: string, value: unknown): Promise<void> {
  const data = Buffer.from(JSON.stringify(value), "utf8");
  await db.storedBlob.upsert({
    where: { key },
    update: { data, size: data.length, contentType: "application/json" },
    create: { key, data, size: data.length, contentType: "application/json" },
  });
}

function withTier(
  author: StoredAuthor,
  tiers: Record<string, CommunityTier>,
): AuthorSnapshot {
  return {
    id: author.id,
    username: author.username ?? null,
    displayName: author.displayName ?? null,
    avatarUrl: author.avatarUrl ?? null,
    tier: tiers[author.id] ?? author.tier ?? "free",
  };
}

function hydratePost(
  post: StoredPost,
  tiers: Record<string, CommunityTier>,
  likedIds: string[],
  repostedIds: string[],
  viewerId: string | null,
): CommunityPost {
  return {
    id: post.id,
    author: withTier(post.author, tiers),
    body: post.body,
    kind: post.kind,
    refId: post.refId,
    imageUrl: post.imageUrl,
    repostOf: post.repostOf
      ? {
          id: post.repostOf.id,
          author: withTier(post.repostOf.author, tiers),
          body: post.repostOf.body,
        }
      : null,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    repostCount: post.repostCount,
    shareCount: post.shareCount,
    liked: viewerId ? likedIds.includes(viewerId) : false,
    reposted: viewerId ? repostedIds.includes(viewerId) : false,
    createdAt: post.createdAt,
  };
}

/** Priority order mirrors the asset variants created by the upload pipeline. */
const IMAGE_VARIANTS = ["grid", "thumbnail", "detail", "mobile", "desktop", "original"];

function pickImage(
  assets: { variant: string; objectKey: string }[],
): string | null {
  for (const variant of IMAGE_VARIANTS) {
    const found = assets.find((a) => a.variant === variant);
    if (found) return found.objectKey;
  }
  return assets[0]?.objectKey ?? null;
}

/**
 * Deterministic first-run seed. Bodies and IDs are fixed; author snapshots and
 * context references are taken from real database rows whenever available.
 */
async function seedPosts(): Promise<StoredPost[]> {
  const [profiles, wallpapers, projects] = await Promise.all([
    db.profile.findMany({
      orderBy: { createdAt: "asc" },
      take: 6,
      select: { userId: true, username: true, displayName: true, avatarUrl: true },
    }),
    db.wallpaper.findMany({
      where: { status: "approved", isPublic: true },
      take: 1,
      select: {
        slug: true,
        assets: {
          select: { variant: true, objectKey: true },
        },
      },
    }),
    db.creativeProject.findMany({
      where: { isPublic: true },
      take: 1,
      select: { id: true },
    }),
  ]);

  const tiers = await getTiersForUsers(profiles.map((p) => p.userId));
  const authors: StoredAuthor[] = profiles.map((p) => ({
    id: p.userId,
    username: p.username,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    tier: tiers[p.userId] ?? "free",
  }));
  while (authors.length < 6) authors.push(SYSTEM_AUTHOR);

  const wallpaper = wallpapers[0] ?? null;
  const project = projects[0] ?? null;
  const hoursAgo = (hours: number) =>
    new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const drafts: {
    body: string;
    hours: number;
    kind: PostKind;
    refId: string | null;
    imageUrl: string | null;
    repostIndex: number | null;
    counts: [number, number, number, number];
  }[] = [
    {
      body:
        "Just finished a new atmospheric wallpaper set — deep indigo skies, soft grain and a hint of warm light on the horizon. Which palette should I explore next?",
      hours: 2,
      kind: wallpaper ? "wallpaper" : "text",
      refId: wallpaper?.slug ?? null,
      imageUrl: wallpaper ? pickImage(wallpaper.assets) : null,
      repostIndex: null,
      counts: [24, 7, 9, 4],
    },
    {
      body:
        "Six months of moodboards, iterations and tiny details are finally in one place. The new project board is live — feedback very welcome.",
      hours: 7,
      kind: project ? "project" : "text",
      refId: project?.id ?? null,
      imageUrl: null,
      repostIndex: null,
      counts: [16, 4, 5, 2],
    },
    {
      body:
        "Reminder for anyone stuck: your drafts are valid. Share the messy middle, not only the polished final. The process is part of the work.",
      hours: 26,
      kind: "text",
      refId: null,
      imageUrl: null,
      repostIndex: null,
      counts: [41, 12, 14, 6],
    },
    {
      body:
        "Colour study — warm amber against cool concrete. I keep coming back to this contrast for the next series.",
      hours: 50,
      kind: "text",
      refId: null,
      imageUrl: null,
      repostIndex: null,
      counts: [12, 3, 4, 1],
    },
    {
      body:
        "Snapping this one — the composition notes here helped me finally fix a layout I had been fighting with all week.",
      hours: 74,
      kind: "text",
      refId: null,
      imageUrl: null,
      repostIndex: 0,
      counts: [8, 2, 6, 1],
    },
    {
      body:
        "Trying a slower creative routine this week: one small piece every day, no pressure to perfect it. Small wins add up.",
      hours: 98,
      kind: "text",
      refId: null,
      imageUrl: null,
      repostIndex: null,
      counts: [31, 9, 11, 3],
    },
  ];

  const posts: StoredPost[] = drafts.map((draft, index) => ({
    id: `cp_seed_${index + 1}`,
    author: authors[index] ?? SYSTEM_AUTHOR,
    body: draft.body,
    kind: draft.kind,
    refId: draft.refId,
    imageUrl: draft.imageUrl,
    repostOf:
      draft.repostIndex !== null && drafts[draft.repostIndex]
        ? {
            id: `cp_seed_${draft.repostIndex + 1}`,
            author: authors[draft.repostIndex] ?? SYSTEM_AUTHOR,
            body: drafts[draft.repostIndex].body,
          }
        : null,
    likeCount: draft.counts[0],
    commentCount: draft.counts[1],
    repostCount: draft.counts[2],
    shareCount: draft.counts[3],
    createdAt: hoursAgo(draft.hours),
  }));

  await write(POSTS_KEY, posts);
  return posts;
}

async function readPosts(): Promise<StoredPost[]> {
  const posts = await read<StoredPost[]>(POSTS_KEY, []);
  if (posts.length > 0) return posts;
  return seedPosts();
}

async function readMemberships(key: string): Promise<Record<string, string[]>> {
  return read<Record<string, string[]>>(key, {});
}

/** Validate a context reference so the feed never links to a missing record. */
async function resolveRef(
  kind: PostKind,
  refId: string | null,
): Promise<{ kind: PostKind; refId: string | null; imageUrl: string | null }> {
  if (!refId) return { kind: "text", refId: null, imageUrl: null };

  if (kind === "wallpaper") {
    const wallpaper = await db.wallpaper.findFirst({
      where: {
        OR: [{ slug: refId }, { id: refId }],
        status: "approved",
        isPublic: true,
      },
      select: {
        slug: true,
        assets: { select: { variant: true, objectKey: true } },
      },
    });
    if (wallpaper) {
      return {
        kind: "wallpaper",
        refId: wallpaper.slug,
        imageUrl: pickImage(wallpaper.assets),
      };
    }
  }

  if (kind === "project") {
    const project = await db.creativeProject.findFirst({
      where: { id: refId, isPublic: true },
      select: { id: true, coverUrl: true },
    });
    if (project) {
      return {
        kind: "project",
        refId: project.id,
        imageUrl: project.coverUrl,
      };
    }
  }

  return { kind: "text", refId: null, imageUrl: null };
}

/**
 * Re-check references on read so a deleted or unlisted wallpaper/project never
 * produces a dead link in an older post.
 */
async function liveRefKeys(posts: StoredPost[]): Promise<Set<string>> {
  const wallpaperSlugs = [
    ...new Set(
      posts
        .filter((post) => post.kind === "wallpaper" && post.refId)
        .map((post) => post.refId as string),
    ),
  ];
  const projectIds = [
    ...new Set(
      posts
        .filter((post) => post.kind === "project" && post.refId)
        .map((post) => post.refId as string),
    ),
  ];
  if (wallpaperSlugs.length === 0 && projectIds.length === 0) return new Set();

  const [wallpapers, projects] = await Promise.all([
    wallpaperSlugs.length
      ? db.wallpaper.findMany({
          where: { slug: { in: wallpaperSlugs }, status: "approved", isPublic: true },
          select: { slug: true },
        })
      : Promise.resolve([]),
    projectIds.length
      ? db.creativeProject.findMany({
          where: { id: { in: projectIds }, isPublic: true },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  return new Set([
    ...wallpapers.map((w) => `wallpaper:${w.slug}`),
    ...projects.map((p) => `project:${p.id}`),
  ]);
}

function withoutDeadRef(post: StoredPost, liveKeys: Set<string>): StoredPost {
  if (!post.refId || liveKeys.has(`${post.kind}:${post.refId}`)) return post;
  return { ...post, kind: "text", refId: null, imageUrl: null };
}

/** Profile snapshot used for freshly created posts and comments. */
export async function getAuthorSnapshot(
  userId: string,
  fallback: { username?: string | null; displayName?: string | null; avatarUrl?: string | null } = {},
): Promise<AuthorSnapshot> {
  const [profile, tiers] = await Promise.all([
    db.profile.findUnique({
      where: { userId },
      select: { username: true, displayName: true, avatarUrl: true },
    }),
    getTiersForUsers([userId]),
  ]);
  return {
    id: userId,
    username: profile?.username ?? fallback.username ?? null,
    displayName: profile?.displayName ?? fallback.displayName ?? null,
    avatarUrl: profile?.avatarUrl ?? fallback.avatarUrl ?? null,
    tier: tiers[userId] ?? "free",
  };
}

/** Single blob read for tiers per feed page (no N+1 lookups). */
async function tiersForPosts(posts: StoredPost[]): Promise<Record<string, CommunityTier>> {
  const ids = posts.flatMap((p) => [
    p.author.id,
    ...(p.repostOf ? [p.repostOf.author.id] : []),
  ]);
  return getTiersForUsers(ids);
}

export async function listPosts(opts: {
  q: string;
  sort: FeedSort;
  page: number;
  limit: number;
  viewerId: string | null;
}): Promise<{ items: CommunityPost[]; pagination: FeedPagination }> {
  const posts = await readPosts();
  const [likes, reposts] = await Promise.all([
    readMemberships(LIKES_KEY),
    readMemberships(REPOSTS_KEY),
  ]);

  const needle = opts.q.trim().toLowerCase();
  const filtered = needle
    ? posts.filter((post) =>
        [
          post.body,
          post.author.username ?? "",
          post.author.displayName ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
    : posts;

  const sorted = [...filtered].sort((a, b) => {
    if (opts.sort === "popular") {
      const score = (p: StoredPost) =>
        p.likeCount * 3 + p.commentCount * 2 + p.repostCount * 2 + p.shareCount;
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });

  const total = sorted.length;
  const start = (opts.page - 1) * opts.limit;
  const pageItems = sorted.slice(start, start + opts.limit);
  const [tiers, liveKeys] = await Promise.all([
    tiersForPosts(pageItems),
    liveRefKeys(pageItems),
  ]);

  return {
    items: pageItems.map((post) =>
      hydratePost(
        withoutDeadRef(post, liveKeys),
        tiers,
        likes[post.id] ?? [],
        reposts[post.id] ?? [],
        opts.viewerId,
      ),
    ),
    pagination: {
      page: opts.page,
      limit: opts.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / opts.limit)),
    },
  };
}

export async function getStoredPost(id: string): Promise<StoredPost | null> {
  const posts = await readPosts();
  return posts.find((post) => post.id === id) ?? null;
}

export async function getPost(
  id: string,
  viewerId: string | null,
): Promise<CommunityPost | null> {
  const post = await getStoredPost(id);
  if (!post) return null;
  const [likes, reposts, tiers, liveKeys] = await Promise.all([
    readMemberships(LIKES_KEY),
    readMemberships(REPOSTS_KEY),
    tiersForPosts([post]),
    liveRefKeys([post]),
  ]);
  return hydratePost(
    withoutDeadRef(post, liveKeys),
    tiers,
    likes[id] ?? [],
    reposts[id] ?? [],
    viewerId,
  );
}

export async function createPost(input: {
  body: string;
  kind: PostKind;
  refId: string | null;
  repostOf: string | null;
  author: AuthorSnapshot;
}): Promise<CommunityPost> {
  const posts = await readPosts();
  const ref = await resolveRef(input.kind, input.refId);
  const source = input.repostOf
    ? posts.find((post) => post.id === input.repostOf)
    : null;

  const post: StoredPost = {
    id: `cp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    author: input.author,
    body: input.body,
    kind: ref.kind,
    refId: ref.refId,
    imageUrl: ref.imageUrl,
    repostOf: source
      ? { id: source.id, author: source.author, body: source.body }
      : null,
    likeCount: 0,
    commentCount: 0,
    repostCount: 0,
    shareCount: 0,
    createdAt: new Date().toISOString(),
  };

  const next = posts.map((existing) =>
    source && existing.id === source.id
      ? { ...existing, repostCount: existing.repostCount + 1 }
      : existing,
  );
  next.unshift(post);
  await write(POSTS_KEY, next);

  return hydratePost(post, {}, [], [], post.author.id);
}

export async function deletePost(id: string): Promise<boolean> {
  const posts = await readPosts();
  if (!posts.some((p) => p.id === id)) return false;
  await write(
    POSTS_KEY,
    posts.filter((p) => p.id !== id),
  );

  const [likes, reposts, comments, shares] = await Promise.all([
    readMemberships(LIKES_KEY),
    readMemberships(REPOSTS_KEY),
    read<Record<string, StoredComment[]>>(COMMENTS_KEY, {}),
    read<Record<string, number>>(SHARES_KEY, {}),
  ]);
  delete likes[id];
  delete reposts[id];
  delete comments[id];
  delete shares[id];
  await Promise.all([
    write(LIKES_KEY, likes),
    write(REPOSTS_KEY, reposts),
    write(COMMENTS_KEY, comments),
    write(SHARES_KEY, shares),
  ]);
  return true;
}

export async function countPostsToday(userId: string): Promise<number> {
  const posts = await readPosts();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const since = start.toISOString();
  return posts.filter(
    (p) =>
      p.author.id === userId &&
      !p.id.startsWith("cp_seed_") &&
      p.createdAt >= since,
  ).length;
}

/** Idempotent: POST maps to `liked: true`, DELETE to `liked: false`. */
export async function setLike(
  postId: string,
  userId: string,
  liked: boolean,
): Promise<{ liked: boolean; likeCount: number } | null> {
  const posts = await readPosts();
  const index = posts.findIndex((p) => p.id === postId);
  if (index === -1) return null;

  const likes = await readMemberships(LIKES_KEY);
  const current = likes[postId] ?? [];
  const already = current.includes(userId);
  if (already !== liked) {
    likes[postId] = liked
      ? [userId, ...current]
      : current.filter((id) => id !== userId);
    const likeCount = Math.max(
      0,
      posts[index].likeCount + (liked ? 1 : -1),
    );
    posts[index] = { ...posts[index], likeCount };
    await Promise.all([write(POSTS_KEY, posts), write(LIKES_KEY, likes)]);
  }

  return { liked, likeCount: posts[index].likeCount };
}

/** Idempotent: POST maps to `reposted: true`, DELETE to `reposted: false`. */
export async function setRepost(
  postId: string,
  userId: string,
  reposted: boolean,
): Promise<{ reposted: boolean; repostCount: number } | null> {
  const posts = await readPosts();
  const index = posts.findIndex((p) => p.id === postId);
  if (index === -1) return null;

  const reposts = await readMemberships(REPOSTS_KEY);
  const current = reposts[postId] ?? [];
  const already = current.includes(userId);
  if (already !== reposted) {
    reposts[postId] = reposted
      ? [userId, ...current]
      : current.filter((id) => id !== userId);
    const repostCount = Math.max(
      0,
      posts[index].repostCount + (reposted ? 1 : -1),
    );
    posts[index] = { ...posts[index], repostCount };
    await Promise.all([write(POSTS_KEY, posts), write(REPOSTS_KEY, reposts)]);
  }

  return { reposted, repostCount: posts[index].repostCount };
}

export async function listComments(postId: string): Promise<CommunityComment[]> {
  const all = await read<Record<string, StoredComment[]>>(COMMENTS_KEY, {});
  const comments = all[postId] ?? [];
  const tiers = await getTiersForUsers(comments.map((c) => c.author.id));
  return comments.map((comment) => ({
    ...comment,
    author: withTier(comment.author, tiers),
  }));
}

export async function addComment(
  postId: string,
  content: string,
  author: AuthorSnapshot,
): Promise<CommunityComment | null> {
  const posts = await readPosts();
  const index = posts.findIndex((p) => p.id === postId);
  if (index === -1) return null;

  const comment: StoredComment = {
    id: `cc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    postId,
    author,
    content,
    createdAt: new Date().toISOString(),
  };

  const all = await read<Record<string, StoredComment[]>>(COMMENTS_KEY, {});
  all[postId] = [comment, ...(all[postId] ?? [])];
  posts[index] = {
    ...posts[index],
    commentCount: posts[index].commentCount + 1,
  };

  await Promise.all([
    write(COMMENTS_KEY, all),
    write(POSTS_KEY, posts),
  ]);
  return { ...comment, author: withTier(author, {}) };
}

export async function incrementShare(postId: string): Promise<number | null> {
  const posts = await readPosts();
  const index = posts.findIndex((p) => p.id === postId);
  if (index === -1) return null;
  const shareCount = posts[index].shareCount + 1;
  posts[index] = { ...posts[index], shareCount };
  await write(POSTS_KEY, posts);
  return shareCount;
}
