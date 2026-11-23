import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEvent } from "expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useVideoPlayer,
  VideoView,
  type VideoSource,
} from "expo-video";

import { TvSignalSearching } from "../../components/media/TvSignalSearching";
import { apiJson } from "../../lib/api";
import { API_BASE, assetUrl } from "../../lib/config";
import { useAuth } from "../../lib/auth";
import { isHls } from "../../lib/videoLibrary";
import { C, R } from "../../lib/theme";

type FeedPost = {
  id: string;
  body?: string;
  kind?: string | null;
  author?: {
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
  channelId?: string | null;
  channelName?: string | null;
  channelGroup?: string | null;
  streamUrl?: string | null;
  previewUrl?: string | null;
  videoUrl?: string | null;
  durationSec?: number | null;
  likeCount?: number;
  commentCount?: number;
  repostCount?: number;
  shareCount?: number;
  liked?: boolean;
  reposted?: boolean;
  createdAt?: string;
};

type Reel = {
  id: string;
  uri: string;
  body: string;
  source: "tv" | "community";
  channelName?: string | null;
  authorName: string;
  authorUsername?: string | null;
  avatarUrl?: string | null;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  shareCount: number;
  liked: boolean;
  reposted: boolean;
  createdAt?: string;
};

const LEGACY_CLIP = /9s live preview:\s*(https?:\/\/\S+)/i;
const VIEWPORT_HEIGHT = Dimensions.get("window").height;

function countLabel(value: number | undefined) {
  const n = typeof value === "number" ? value : 0;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

/** Turn a community post with a captured clip into a playable reel. */
function toReel(post: FeedPost): Reel | null {
  const legacy = post.body?.match(LEGACY_CLIP)?.[1];
  const uri =
    assetUrl(post.videoUrl) ??
    assetUrl(post.streamUrl) ??
    (legacy ? assetUrl(legacy) : undefined);
  if (!uri) return null;

  const fromTv =
    post.kind === "channel_clip" ||
    !!post.channelName ||
    !!post.streamUrl ||
    !!legacy;
  const cleanBody = (post.body ?? "")
    .replace(LEGACY_CLIP, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

  return {
    id: post.id,
    uri,
    body:
      cleanBody ||
      (fromTv
        ? `${post.channelName ?? "WALLORA TV"} — live on WALLORA TV`
        : "A moment from the WALLORA community"),
    source: fromTv ? "tv" : "community",
    channelName: post.channelName ?? null,
    authorName:
      post.author?.displayName ?? post.author?.username ?? "WALLORA",
    authorUsername: post.author?.username ?? null,
    avatarUrl: assetUrl(post.author?.avatarUrl) ?? null,
    likeCount: post.likeCount ?? 0,
    commentCount: post.commentCount ?? 0,
    repostCount: post.repostCount ?? 0,
    shareCount: post.shareCount ?? 0,
    liked: !!post.liked,
    reposted: !!post.reposted,
    createdAt: post.createdAt,
  };
}

function ReelCard({
  reel,
  active,
  onLike,
  onRepost,
  onShare,
  onComment,
  onOpenChannel,
  busy,
  insetsTop,
  insetsBottom,
}: {
  reel: Reel;
  active: boolean;
  onLike: () => void;
  onRepost: () => void;
  onShare: () => void;
  onComment: () => void;
  onOpenChannel: () => void;
  busy: boolean;
  insetsTop: number;
  insetsBottom: number;
}) {
  const source = useMemo<VideoSource>(
    () => ({
      uri: reel.uri,
      contentType: isHls(reel.uri) ? "hls" : "auto",
      metadata: { title: reel.body.slice(0, 80), artist: "WALLORA Reels" },
    }),
    [reel.body, reel.uri],
  );
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = true;
    instance.muted = false;
  });
  const { status } = useEvent(player, "statusChange", { status: player.status });
  const [heartVisible, setHeartVisible] = useState(false);
  const heartScale = useMemo(() => new Animated.Value(0), []);
  const lastTap = useRef(0);

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  const togglePlay = () => {
    if (player.playing) player.pause();
    else player.play();
  };

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      onLike();
      setHeartVisible(true);
      heartScale.setValue(0.4);
      Animated.sequence([
        Animated.timing(heartScale, {
          toValue: 1.25,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(heartScale, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(() => setHeartVisible(false), 420);
      });
    } else {
      lastTap.current = now;
      togglePlay();
    }
  };

  const buffering = status === "loading" || status === "readyToPlay";

  return (
    <View style={styles.reel}>
      <Pressable style={StyleSheet.absoluteFill} onPress={handleTap}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          surfaceType="textureView"
          nativeControls={false}
        />
      </Pressable>

      <View style={styles.topShade} pointerEvents="none" />
      <View style={styles.bottomShade} pointerEvents="none" />

      <View style={[styles.topBar, { paddingTop: insetsTop + 10 }]} pointerEvents="box-none">
        <View style={styles.brandPill}>
          <Ionicons name="tv-outline" size={13} color={C.accent} />
          <Text style={styles.brandText}>WALLORA REELS</Text>
        </View>
        {reel.source === "tv" ? (
          <Pressable onPress={onOpenChannel} style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText} numberOfLines={1}>
              {reel.channelName ?? "WALLORA TV"}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.livePill}>
            <Ionicons name="people-outline" size={11} color={C.textSoft} />
            <Text style={styles.livePillText}>COMMUNITY</Text>
          </View>
        )}
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.heartBurst,
          {
            opacity: heartVisible ? 1 : 0,
            transform: [{ scale: heartScale }],
          },
        ]}
      >
        <Ionicons name="heart" size={86} color={C.accent} />
      </Animated.View>

      {buffering ? (
        <View style={styles.bufferWrap} pointerEvents="none">
          <TvSignalSearching
            label={reel.source === "tv" ? "SEARCHING SIGNAL" : "LOADING REEL"}
            detail="Preparing the smoothest playback for your connection…"
            channelName={reel.source === "tv" ? reel.channelName ?? undefined : undefined}
            compact
          />
        </View>
      ) : null}

      <View style={[styles.bottom, { paddingBottom: insetsBottom + 16 }]} pointerEvents="box-none">
        <View style={styles.info}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              {reel.avatarUrl ? (
                <Image source={{ uri: reel.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={15} color={C.textSoft} />
              )}
            </View>
            <Text style={styles.author} numberOfLines={1}>
              {reel.authorUsername ? `@${reel.authorUsername}` : reel.authorName}
            </Text>
            {reel.source === "tv" ? (
              <View style={styles.sourceBadge}>
                <Text style={styles.sourceBadgeText}>WALLORA TV</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.caption} numberOfLines={3}>
            {reel.body}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="play-outline" size={11} color={C.muted} />
            <Text style={styles.metaText}>
              {reel.source === "tv" ? "9s live capture" : "community clip"}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={onLike}
            disabled={busy}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            <Ionicons
              name={reel.liked ? "heart" : "heart-outline"}
              size={28}
              color={reel.liked ? C.error : C.white}
            />
            <Text style={styles.actionCount}>{countLabel(reel.likeCount)}</Text>
          </Pressable>
          <Pressable onPress={onComment} style={styles.action}>
            <Ionicons name="chatbubble-outline" size={26} color={C.white} />
            <Text style={styles.actionCount}>{countLabel(reel.commentCount)}</Text>
          </Pressable>
          <Pressable onPress={onRepost} disabled={busy} style={styles.action}>
            <Ionicons
              name="repeat-outline"
              size={26}
              color={reel.reposted ? C.success : C.white}
            />
            <Text style={styles.actionCount}>{countLabel(reel.repostCount)}</Text>
          </Pressable>
          <Pressable onPress={onShare} disabled={busy} style={styles.action}>
            <Ionicons name="share-outline" size={26} color={C.white} />
            <Text style={styles.actionCount}>{countLabel(reel.shareCount)}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function ReelsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      // The updated API honours `kind`; the deployed one ignores it, so the
      // local `toReel` filter keeps the feed working against either version.
      let data = await apiJson<{ items?: FeedPost[] }>(
        "/api/v1/community/posts?kind=channel_clip&sort=recent&limit=50",
      );
      let items = Array.isArray(data?.items) ? data.items : [];
      let normalized = items.map(toReel).filter((r): r is Reel => !!r);

      if (!normalized.length) {
        data = await apiJson<{ items?: FeedPost[] }>(
          "/api/v1/community/posts?sort=recent&limit=50",
        );
        items = Array.isArray(data?.items) ? data.items : [];
        normalized = items.map(toReel).filter((r): r is Reel => !!r);
      }

      setReels((prev) => {
        const merged = [...normalized];
        const seen = new Set(merged.map((r) => r.id));
        prev.forEach((r) => {
          if (!seen.has(r.id)) merged.push(r);
        });
        return merged;
      });
      setActiveIndex(0);
    } catch (e: any) {
      setError(e?.message ?? "Could not load WALLORA Reels.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const requireAuth = useCallback(() => {
    if (user) return true;
    router.push("/auth/login");
    return false;
  }, [user]);

  const updateReel = useCallback((id: string, patch: Partial<Reel>) => {
    setReels((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const toggleLike = useCallback(
    async (reel: Reel) => {
      if (!requireAuth() || busyId) return;
      const next = !reel.liked;
      setBusyId(reel.id);
      updateReel(reel.id, { liked: next, likeCount: Math.max(0, reel.likeCount + (next ? 1 : -1)) });
      try {
        const result = await apiJson<{ liked?: boolean; likeCount?: number }>(
          `/api/v1/community/posts/${reel.id}/like`,
          { method: next ? "POST" : "DELETE" },
        );
        updateReel(reel.id, {
          liked: typeof result?.liked === "boolean" ? result.liked : next,
          likeCount:
            typeof result?.likeCount === "number"
              ? result.likeCount
              : Math.max(0, reel.likeCount + (next ? 1 : -1)),
        });
      } catch {
        updateReel(reel.id, { liked: reel.liked, likeCount: reel.likeCount });
      } finally {
        setBusyId(null);
      }
    },
    [busyId, requireAuth, updateReel],
  );

  const toggleRepost = useCallback(
    async (reel: Reel) => {
      if (!requireAuth() || busyId) return;
      const next = !reel.reposted;
      setBusyId(reel.id);
      updateReel(reel.id, {
        reposted: next,
        repostCount: Math.max(0, reel.repostCount + (next ? 1 : -1)),
      });
      try {
        const result = await apiJson<{ reposted?: boolean; repostCount?: number }>(
          `/api/v1/community/posts/${reel.id}/repost`,
          { method: next ? "POST" : "DELETE" },
        );
        updateReel(reel.id, {
          reposted: typeof result?.reposted === "boolean" ? result.reposted : next,
          repostCount:
            typeof result?.repostCount === "number"
              ? result.repostCount
              : Math.max(0, reel.repostCount + (next ? 1 : -1)),
        });
      } catch {
        updateReel(reel.id, {
          reposted: reel.reposted,
          repostCount: reel.repostCount,
        });
      } finally {
        setBusyId(null);
      }
    },
    [busyId, requireAuth, updateReel],
  );

  const shareReel = useCallback(
    async (reel: Reel) => {
      if (!requireAuth() || busyId) return;
      setBusyId(reel.id);
      try {
        const result = await apiJson<{ shareUrl?: string; shareCount?: number }>(
          `/api/v1/community/posts/${reel.id}/share`,
          { method: "POST", body: JSON.stringify({ platform: "copy" }) },
        );
        const url = result?.shareUrl ?? `${API_BASE}/community?post=${encodeURIComponent(reel.id)}`;
        updateReel(reel.id, {
          shareCount:
            typeof result?.shareCount === "number"
              ? result.shareCount
              : reel.shareCount + 1,
        });
        try {
          await Share.share({
            title: "WALLORA Reel",
            message: reel.body.slice(0, 160),
            url,
          });
        } catch {
          // Dismissing the share sheet still leaves the API share recorded.
        }
      } catch {
        // Sharing is best-effort.
      } finally {
        setBusyId(null);
      }
    },
    [busyId, requireAuth, updateReel],
  );

  const viewConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 70 }),
    [],
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        <TvSignalSearching
          label="OPENING WALLORA REELS"
          detail="Finding clips from WALLORA TV and the community…"
          compact
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={reels}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
        }
        onViewableItemsChanged={({ viewableItems }) => {
          const first = viewableItems[0];
          if (first?.index != null) setActiveIndex(first.index);
        }}
        viewabilityConfig={viewConfig}
        renderItem={({ item, index }) => (
          <ReelCard
            reel={item}
            active={index === activeIndex}
            busy={busyId === item.id}
            insetsTop={insets.top}
            insetsBottom={insets.bottom}
            onLike={() => void toggleLike(item)}
            onRepost={() => void toggleRepost(item)}
            onShare={() => void shareReel(item)}
            onComment={() => router.push(`/community/${item.id}`)}
            onOpenChannel={() => router.push(`/live-tv?channel=${encodeURIComponent(item.id)}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="videocam-outline" size={44} color={C.muted} />
            <Text style={styles.emptyTitle}>No reels yet</Text>
            <Text style={styles.emptyText}>
              {error ?? "Share a 9-second clip from a live channel and it will appear here."}
            </Text>
            <View style={styles.emptyActions}>
              <Pressable style={styles.emptyButton} onPress={() => router.push("/live-tv")}>
                <Text style={styles.emptyButtonText}>Open WALLORA TV</Text>
              </Pressable>
              <Pressable style={styles.emptyButtonGhost} onPress={onRefresh}>
                <Text style={styles.emptyButtonGhostText}>Refresh</Text>
              </Pressable>
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bgDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  reel: {
    height: VIEWPORT_HEIGHT,
    width: "100%",
    backgroundColor: C.bgDeep,
    overflow: "hidden",
  },
  topShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 150,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  bottomShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 300,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  brandPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: R.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  brandText: {
    color: C.accentBright,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "55%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: R.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FF4D4D" },
  livePillText: { color: C.white, fontSize: 10, fontWeight: "800" },
  heartBurst: {
    position: "absolute",
    alignSelf: "center",
    top: "42%",
    shadowColor: "#000",
    shadowRadius: 16,
    shadowOpacity: 0.5,
  },
  bufferWrap: {
    position: "absolute",
    alignSelf: "center",
    top: "38%",
  },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    gap: 12,
  },
  info: { flex: 1, minWidth: 0 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  avatarImage: { width: 30, height: 30 },
  author: { color: C.white, fontSize: 13, fontWeight: "800", flexShrink: 1 },
  sourceBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: R.pill,
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accent + "66",
  },
  sourceBadgeText: { color: C.accentBright, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  caption: {
    color: C.white,
    fontSize: 13,
    lineHeight: 19,
    textShadowColor: "#000",
    textShadowRadius: 3,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  metaText: { color: C.textSoft, fontSize: 10 },
  actions: { alignItems: "center", gap: 16 },
  action: { alignItems: "center", width: 44 },
  actionPressed: { opacity: 0.6 },
  actionCount: { color: C.white, fontSize: 10, fontWeight: "700", marginTop: 3 },
  empty: {
    flex: 1,
    width: undefined,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    gap: 8,
  },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: "800", marginTop: 10 },
  emptyText: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  emptyActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  emptyButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: R.md,
    backgroundColor: C.accent,
  },
  emptyButtonText: { color: C.bg, fontSize: 12, fontWeight: "800" },
  emptyButtonGhost: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyButtonGhostText: { color: C.textSoft, fontSize: 12, fontWeight: "700" },
});
