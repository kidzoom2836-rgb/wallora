import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
  Share,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ScreenHeader } from "../components/ui/ScreenHeader";
import { VerifiedBadge } from "../components/ui/VerifiedBadge";
import { apiJson } from "../lib/api";
import { API_BASE, assetUrl } from "../lib/config";
import { C, R, S } from "../lib/theme";
import { useAuth } from "../lib/auth";

type CommunityAuthor = {
  id?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string | null;
  tier?: string | null;
};

type CommunityPost = {
  id: string;
  author: CommunityAuthor;
  body: string;
  kind?: string | null;
  refId?: string | null;
  imageUrl?: string | null;
  likeCount: number;
  commentCount?: number;
  repostCount: number;
  shareCount: number;
  liked?: boolean;
  reposted?: boolean;
  createdAt: string;
};

type Pagination = {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
};

type ActionResult = {
  liked?: boolean;
  reposted?: boolean;
  likeCount?: number;
  repostCount?: number;
  shareCount?: number;
  shareUrl?: string;
};

const PAGE_SIZE = 12;

function countLabel(value: number | undefined) {
  const n = typeof value === "number" ? value : 0;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function dateLabel(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Banner({ message, tone = "error" }: { message: string | null; tone?: "error" | "success" | "info" }) {
  if (!message) return null;
  const color = tone === "success" ? C.success : tone === "info" ? C.blue : C.error;
  const icon = tone === "success" ? "checkmark-circle-outline" : tone === "info" ? "information-circle-outline" : "alert-circle-outline";
  return (
    <View style={[styles.banner, { borderColor: color + "55" }]}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.bannerText, { color }]}>{message}</Text>
    </View>
  );
}

export default function CommunityScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState<"recent" | "popular">("recent");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: "error" | "success" | "info" } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      setError(null);
      if (nextPage > 1) setLoadingMore(true);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: String(PAGE_SIZE),
          sort,
        });
        if (search) params.set("q", search);
        const data = await apiJson<{ items: CommunityPost[]; pagination: Pagination }>(
          `/api/v1/community/posts?${params.toString()}`,
        );
        const items = Array.isArray(data?.items) ? data.items : [];
        setPosts((prev) => (replace ? items : [...prev, ...items]));
        setTotal(data?.pagination?.total ?? 0);
        setPage(data?.pagination?.page ?? nextPage);
        setTotalPages(data?.pagination?.totalPages ?? 1);
      } catch (e: any) {
        setError(e?.message ?? "Could not load community posts.");
        if (replace) setPosts([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [search, sort],
  );

  useEffect(() => {
    setLoading(true);
    void load(1, true);
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load(1, true);
  }, [load]);

  const requireAuth = useCallback(() => {
    if (user) return true;
    setNotice({ message: "Sign in to like, repost and share posts.", tone: "info" });
    return false;
  }, [user]);

  const toggleLike = async (post: CommunityPost) => {
    if (!requireAuth() || busyId) return;
    const next = !post.liked;
    setBusyId(post.id);
    setNotice(null);
    try {
      const result = await apiJson<ActionResult>(`/api/v1/community/posts/${post.id}/like`, {
        method: next ? "POST" : "DELETE",
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                liked: typeof result?.liked === "boolean" ? result.liked : next,
                likeCount:
                  typeof result?.likeCount === "number"
                    ? result.likeCount
                    : Math.max(0, p.likeCount + (next ? 1 : -1)),
              }
            : p,
        ),
      );
    } catch (e: any) {
      setNotice({ message: e?.message ?? "Could not update like.", tone: "error" });
    } finally {
      setBusyId(null);
    }
  };

  const toggleRepost = async (post: CommunityPost) => {
    if (!requireAuth() || busyId) return;
    const next = !post.reposted;
    setBusyId(post.id);
    setNotice(null);
    try {
      const result = await apiJson<ActionResult>(`/api/v1/community/posts/${post.id}/repost`, {
        method: next ? "POST" : "DELETE",
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                reposted: typeof result?.reposted === "boolean" ? result.reposted : next,
                repostCount:
                  typeof result?.repostCount === "number"
                    ? result.repostCount
                    : Math.max(0, p.repostCount + (next ? 1 : -1)),
              }
            : p,
        ),
      );
    } catch (e: any) {
      setNotice({ message: e?.message ?? "Could not update repost.", tone: "error" });
    } finally {
      setBusyId(null);
    }
  };

  const sharePost = async (post: CommunityPost) => {
    if (!requireAuth() || busyId) return;
    setBusyId(post.id);
    setNotice(null);
    try {
      const result = await apiJson<ActionResult>(`/api/v1/community/posts/${post.id}/share`, {
        method: "POST",
        body: JSON.stringify({ platform: "app" }),
      });
      const url =
        result?.shareUrl ?? `${API_BASE}/community?post=${encodeURIComponent(post.id)}`;
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                shareCount:
                  typeof result?.shareCount === "number"
                    ? result.shareCount
                    : p.shareCount + 1,
              }
            : p,
        ),
      );
      setNotice({ message: "Share recorded on WALLORA.", tone: "success" });
      try {
        await Share.share({
          title: "WALLORA community post",
          message: `${post.body.slice(0, 180)}\n${url}`,
          url,
        });
      } catch {
        // The share sheet can be dismissed; the API share is already recorded.
      }
    } catch (e: any) {
      setNotice({ message: e?.message ?? "Could not record share.", tone: "error" });
    } finally {
      setBusyId(null);
    }
  };

  const header = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>WALLORA COMMUNITY</Text>
            <Text style={styles.title}>Community</Text>
            <Text style={styles.subtitle}>
              {total ? `${countLabel(total)} real posts from creators` : "Posts from real WALLORA accounts"}
            </Text>
          </View>
          <View style={styles.mark}>
            <Ionicons name="people-outline" size={22} color={C.accent} />
          </View>
        </View>

        <View style={styles.search}>
          <Ionicons name="search-outline" size={17} color={C.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search posts…"
            placeholderTextColor={C.muted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={C.muted} />
            </Pressable>
          )}
        </View>

        <View style={styles.sortRow}>
          {(["recent", "popular"] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => setSort(value)}
              style={[styles.sortChip, sort === value && styles.sortChipActive]}
            >
              <Ionicons
                name={value === "recent" ? "time-outline" : "trending-up-outline"}
                size={13}
                color={sort === value ? C.bg : C.muted}
              />
              <Text style={[styles.sortText, sort === value && styles.sortTextActive]}>
                {value === "recent" ? "Recent" : "Popular"}
              </Text>
            </Pressable>
          ))}
        </View>

        {!user && (
          <Pressable style={styles.signInCard} onPress={() => router.push("/auth/login")}>
            <Ionicons name="lock-closed-outline" size={17} color={C.accent} />
            <Text style={styles.signInText}>Sign in to like, repost and share posts.</Text>
            <Ionicons name="chevron-forward" size={16} color={C.accent} />
          </Pressable>
        )}
        <Banner message={notice?.message ?? null} tone={notice?.tone} />
      </View>
    ),
    [notice, query, router, sort, total, user],
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Community"
        subtitle="Real conversations, real work"
        right={
          <Pressable onPress={onRefresh} hitSlop={10} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={19} color={C.accent} />
          </Pressable>
        }
      />
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <View style={styles.state}>
              <ActivityIndicator color={C.accent} size="large" />
              <Text style={styles.stateText}>Loading community posts…</Text>
            </View>
          ) : error ? (
            <View style={styles.state}>
              <Ionicons name="cloud-offline-outline" size={42} color={C.muted} />
              <Text style={styles.stateText}>Couldn’t load the feed</Text>
              <Text style={styles.stateSub}>{error}</Text>
              <Pressable style={styles.primaryButton} onPress={onRefresh}>
                <Text style={styles.primaryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.state}>
              <Ionicons name="chatbubbles-outline" size={42} color={C.muted} />
              <Text style={styles.stateText}>No posts found</Text>
              <Text style={styles.stateSub}>
                {search ? "Try a different search or switch the sort order." : "Be the first to share something with the community."}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          posts.length > 0 ? (
            <View style={styles.footer}>
              {error && <Banner message={error} />}
              {page < totalPages ? (
                <Pressable
                  onPress={() => void load(page + 1, false)}
                  disabled={loadingMore}
                  style={[styles.secondaryButton, loadingMore && styles.buttonDisabled]}
                >
                  {loadingMore ? (
                    <ActivityIndicator color={C.accent} size="small" />
                  ) : (
                    <Text style={styles.secondaryButtonText}>Load more posts</Text>
                  )}
                </Pressable>
              ) : (
                <Text style={styles.endText}>You’re all caught up</Text>
              )}
            </View>
          ) : undefined
        }
        renderItem={({ item }) => {
          const image = assetUrl(item.imageUrl);
          const busy = busyId === item.id;
          return (
            <View style={styles.postCard}>
              <View style={styles.postHeader}>
                <View style={styles.avatar}>
                  {assetUrl(item.author?.avatarUrl) ? (
                    <Image source={{ uri: assetUrl(item.author?.avatarUrl) }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarLetter}>
                      {(item.author?.displayName ?? item.author?.username ?? "W").slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.author?.displayName ?? item.author?.username ?? "WALLORA member"}
                    </Text>
                    <VerifiedBadge tier={item.author?.tier} size="sm" />
                  </View>
                  <View style={styles.metaRow}>
                    {item.author?.username ? <Text style={styles.meta}>@{item.author.username}</Text> : null}
                    {item.author?.username ? <Text style={styles.dot}>·</Text> : null}
                    <Text style={styles.meta}>{dateLabel(item.createdAt)}</Text>
                    {item.kind && item.kind !== "text" ? (
                      <>
                        <Text style={styles.dot}>·</Text>
                        <Text style={styles.meta}>{item.kind}</Text>
                      </>
                    ) : null}
                  </View>
                </View>
              </View>

              <Text style={styles.body}>{item.body}</Text>

              {image ? (
                <Image source={{ uri: image }} style={styles.postImage} resizeMode="cover" />
              ) : null}

              <View style={styles.countsRow}>
                <Ionicons name="heart-outline" size={13} color={C.muted} />
                <Text style={styles.countsText}>{countLabel(item.likeCount)} likes</Text>
                <Ionicons name="repeat-outline" size={13} color={C.muted} style={styles.countsIcon} />
                <Text style={styles.countsText}>{countLabel(item.repostCount)} reposts</Text>
                <Ionicons name="share-outline" size={13} color={C.muted} style={styles.countsIcon} />
                <Text style={styles.countsText}>{countLabel(item.shareCount)} shares</Text>
              </View>

              <View style={styles.actionsRow}>
                <Pressable
                  onPress={() => void toggleLike(item)}
                  disabled={busy}
                  style={[styles.action, item.liked && styles.actionActive]}
                >
                  <Ionicons name={item.liked ? "heart" : "heart-outline"} size={16} color={item.liked ? C.error : C.textSoft} />
                  <Text style={[styles.actionText, item.liked && { color: C.error }]}>Like</Text>
                </Pressable>
                <Pressable
                  onPress={() => void toggleRepost(item)}
                  disabled={busy}
                  style={[styles.action, item.reposted && styles.actionActive]}
                >
                  <Ionicons name="repeat" size={16} color={item.reposted ? C.success : C.textSoft} />
                  <Text style={[styles.actionText, item.reposted && { color: C.success }]}>Repost</Text>
                </Pressable>
                <Pressable onPress={() => void sharePost(item)} disabled={busy} style={styles.action}>
                  <Ionicons name="share-outline" size={16} color={C.textSoft} />
                  <Text style={styles.actionText}>Share</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: R.md,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { paddingHorizontal: S.lg, paddingBottom: S.xxxl },
  headerBlock: { paddingTop: S.lg },
  titleRow: { flexDirection: "row", alignItems: "center", gap: S.md, marginBottom: S.lg },
  eyebrow: { fontSize: 10, letterSpacing: 1.6, color: C.accent, fontWeight: "800", marginBottom: 4 },
  title: { fontSize: 27, fontWeight: "800", color: C.text },
  subtitle: { fontSize: 12, color: C.muted, marginTop: 3 },
  mark: {
    width: 44,
    height: 44,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: 11,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 14, paddingVertical: 0 },
  sortRow: { flexDirection: "row", gap: S.sm, marginVertical: S.md },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: S.md,
    paddingVertical: 7,
    borderRadius: R.pill,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  sortChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  sortText: { fontSize: 12, fontWeight: "700", color: C.muted },
  sortTextActive: { color: C.bg },
  signInCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accent + "44",
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: 11,
    marginBottom: S.md,
  },
  signInText: { flex: 1, fontSize: 12, color: C.textSoft },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: S.sm,
    borderWidth: 1,
    borderRadius: R.md,
    padding: S.md,
    marginBottom: S.md,
    backgroundColor: C.card,
  },
  bannerText: { flex: 1, fontSize: 12, lineHeight: 18 },
  postCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: S.md,
    marginBottom: S.md,
  },
  postHeader: { flexDirection: "row", alignItems: "center", gap: S.sm },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 40, height: 40 },
  avatarLetter: { fontSize: 16, fontWeight: "800", color: C.accent },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 14, fontWeight: "700", color: C.text, flexShrink: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  meta: { fontSize: 11, color: C.muted },
  dot: { fontSize: 11, color: C.mutedDark },
  body: { color: C.textSoft, fontSize: 14, lineHeight: 21, marginTop: S.md },
  postImage: { width: "100%", height: 190, borderRadius: R.md, marginTop: S.md, backgroundColor: C.raised },
  countsRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5, marginTop: S.md },
  countsIcon: { marginLeft: S.sm },
  countsText: { fontSize: 11, color: C.muted },
  actionsRow: {
    flexDirection: "row",
    marginTop: S.md,
    paddingTop: S.sm,
    borderTopWidth: 1,
    borderTopColor: C.borderSoft,
  },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 7,
    borderRadius: R.sm,
  },
  actionActive: { backgroundColor: C.raised },
  actionText: { fontSize: 12, fontWeight: "700", color: C.textSoft },
  state: { alignItems: "center", paddingVertical: 64, gap: S.sm },
  stateText: { fontSize: 15, fontWeight: "700", color: C.text, textAlign: "center", marginTop: 6 },
  stateSub: { fontSize: 12, color: C.muted, textAlign: "center", paddingHorizontal: S.xl, lineHeight: 18 },
  primaryButton: { backgroundColor: C.accent, borderRadius: R.md, paddingHorizontal: S.xl, paddingVertical: 11, marginTop: S.sm },
  primaryButtonText: { color: C.bg, fontWeight: "800", fontSize: 13 },
  secondaryButton: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  secondaryButtonText: { color: C.accent, fontWeight: "700", fontSize: 13 },
  buttonDisabled: { opacity: 0.6 },
  footer: { paddingVertical: S.lg },
  endText: { textAlign: "center", color: C.mutedDark, fontSize: 11 },
});
