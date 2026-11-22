import { formatDistanceToNowStrict } from "date-fns";

import type {
  AuthorSnapshot,
  CommunityComment,
  CommunityPost,
  FeedPagination,
  PostKind,
} from "@/lib/community/store";

export type {
  AuthorSnapshot,
  CommunityComment,
  CommunityPost,
  FeedPagination,
  PostKind,
};

export type FeedResponse = {
  data: { items: CommunityPost[]; pagination: FeedPagination };
};

export type PostDetailResponse = { data: CommunityPost };

export type CommentsResponse = {
  data: { items: CommunityComment[]; total: number; limit: number };
};

export type SharePlatform =
  | "whatsapp"
  | "instagram"
  | "tiktok"
  | "facebook"
  | "snapchat"
  | "copy";

export type FeedSort = "recent" | "popular";

/** Only resolved references are stored, but guard again on the client. */
export function refHref(post: CommunityPost): string | null {
  if (!post.refId) return null;
  if (post.kind === "wallpaper") {
    return `/wallpaper/${encodeURIComponent(post.refId)}`;
  }
  if (post.kind === "project") {
    return `/projects/${encodeURIComponent(post.refId)}`;
  }
  return null;
}

export function initialsFrom(value: string | null | undefined): string {
  const source = value?.trim();
  if (!source) return "W";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "W";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function relativeTime(iso: string): string {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

export function localShareUrl(id: string): string {
  if (typeof window === "undefined") return `/community?post=${encodeURIComponent(id)}`;
  return `${window.location.origin}/community?post=${encodeURIComponent(id)}`;
}
