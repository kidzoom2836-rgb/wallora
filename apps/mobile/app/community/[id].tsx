import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { VerifiedBadge } from "../../components/ui/VerifiedBadge";
import { ChannelClipCard } from "../../components/media/ChannelClipCard";
import { apiJson } from "../../lib/api";
import { API_BASE, assetUrl, isPlayableClipUri, normalizeMediaUrl } from "../../lib/config";
import { canDeletePost, deleteErrorMessage } from "../../lib/communityPermissions";
import { useAuth } from "../../lib/auth";
import { C, R, S } from "../../lib/theme";
import { withVerification } from "../../lib/verification";

type CommunityAuthor = {
  id?: string;
  username?: string | null;
  displayName?: string | null;
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
  channelId?: string | null;
  channelName?: string | null;
  channelGroup?: string | null;
  streamUrl?: string | null;
  videoUrl?: string | null;
  likeCount: number;
  commentCount?: number;
  repostCount: number;
  shareCount: number;
  liked?: boolean;
  reposted?: boolean;
  createdAt: string;
};

type CommunityComment = {
  id: string;
  postId?: string;
  content: string;
  createdAt: string;
  author: CommunityAuthor;
};

type CommentsResult = {
  items: CommunityComment[];
  total?: number;
  limit?: number;
};

type ActionResult = {
  liked?: boolean;
  reposted?: boolean;
  likeCount?: number;
  repostCount?: number;
  shareCount?: number;
  shareUrl?: string;
};

type Notice = { message: string; tone: "error" | "success" | "info" };

const MAX_COMMENT_LENGTH = 500;

const LIVE_PREVIEW_MARKER = /9s live preview:\s*(https?:\/\/\S+)/i;

function resolvePostMedia(post: CommunityPost): { uri: string | null; body: string } {
  const marker = post.body?.match(LIVE_PREVIEW_MARKER);
  const uri = [post.videoUrl, post.streamUrl, marker?.[1]]
    .map(normalizeMediaUrl)
    .find(isPlayableClipUri) ?? null;
  const body = (post.body ?? "").replace(LIVE_PREVIEW_MARKER, "").trim();
  return { uri, body };
}

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

function Banner({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  const color =
    notice.tone === "success" ? C.success : notice.tone === "info" ? C.blue : C.error;
  const icon =
    notice.tone === "success"
      ? "checkmark-circle-outline"
      : notice.tone === "info"
        ? "information-circle-outline"
        : "alert-circle-outline";
  return (
    <View style={[styles.banner, { borderColor: color + "55" }]}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.bannerText, { color }]}>{notice.message}</Text>
    </View>
  );
}

function AuthorLine({
  author,
  createdAt,
}: {
  author: CommunityAuthor;
  createdAt?: string;
}) {
  const image = assetUrl(author.avatarUrl);
  const name = author.displayName ?? author.username ?? "WALLORA member";
  return (
    <View style={styles.authorRow}>
      <View style={styles.avatar}>
        {image ? (
          <Image source={{ uri: image }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarLetter}>{name.slice(0, 1).toUpperCase()}</Text>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <VerifiedBadge tier={author.tier} size="sm" />
        </View>
        <View style={styles.metaRow}>
          {author.username ? <Text style={styles.meta}>@{author.username}</Text> : null}
          {author.username && createdAt ? <Text style={styles.dot}>·</Text> : null}
          {createdAt ? <Text style={styles.meta}>{dateLabel(createdAt)}</Text> : null}
        </View>
      </View>
    </View>
  );
}

export default function CommunityPostDetailScreen() {
  const params = useLocalSearchParams();
  const idParam = params.id;
  const postId = Array.isArray(idParam) ? idParam[0] : idParam;
  const router = useRouter();
  const { user } = useAuth();

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!postId) {
      setError("This post is no longer available.");
      setPost(null);
      setLoading(false);
      return;
    }
    setError(null);
    setCommentsError(null);
    try {
      const [nextPost, nextComments] = await Promise.all([
        apiJson<CommunityPost>(`/api/v1/community/posts/${postId}`),
        apiJson<CommentsResult>(`/api/v1/community/posts/${postId}/comments`).catch(() => null),
      ]);
      setPost(nextPost);
      setComments(nextComments?.items ?? []);
      if (!nextComments) setCommentsError("Couldn't load comments.");
    } catch (e: any) {
      setPost(null);
      setComments([]);
      setError(e?.message ?? "This post is no longer available.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [postId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const requireAuth = () => {
    if (user) return true;
    setNotice({ message: "Sign in to like, repost and share posts.", tone: "info" });
    return false;
  };

  const toggleLike = async () => {
    if (!post || !requireAuth() || busy) return;
    const next = !post.liked;
    setBusy(true);
    setNotice(null);
    try {
      const result = await apiJson<ActionResult>(`/api/v1/community/posts/${post.id}/like`, {
        method: next ? "POST" : "DELETE",
      });
      setPost((prev) =>
        prev
          ? {
              ...prev,
              liked: typeof result?.liked === "boolean" ? result.liked : next,
              likeCount:
                typeof result?.likeCount === "number"
                  ? result.likeCount
                  : Math.max(0, prev.likeCount + (next ? 1 : -1)),
            }
          : prev,
      );
    } catch (e: any) {
      setNotice({ message: e?.message ?? "Could not update like.", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const toggleRepost = async () => {
    if (!post || !requireAuth() || busy) return;
    const next = !post.reposted;
    setBusy(true);
    setNotice(null);
    try {
      const result = await apiJson<ActionResult>(`/api/v1/community/posts/${post.id}/repost`, {
        method: next ? "POST" : "DELETE",
      });
      setPost((prev) =>
        prev
          ? {
              ...prev,
              reposted: typeof result?.reposted === "boolean" ? result.reposted : next,
              repostCount:
                typeof result?.repostCount === "number"
                  ? result.repostCount
                  : Math.max(0, prev.repostCount + (next ? 1 : -1)),
            }
          : prev,
      );
    } catch (e: any) {
      setNotice({ message: e?.message ?? "Could not update repost.", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const sharePost = async () => {
    if (!post || !requireAuth() || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await apiJson<ActionResult>(`/api/v1/community/posts/${post.id}/share`, {
        method: "POST",
        body: JSON.stringify({ platform: "copy" }),
      });
      const url = result?.shareUrl ?? `${API_BASE}/community?post=${encodeURIComponent(post.id)}`;
      setPost((prev) =>
        prev
          ? {
              ...prev,
              shareCount:
                typeof result?.shareCount === "number" ? result.shareCount : prev.shareCount + 1,
            }
          : prev,
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
      setBusy(false);
    }
  };

  const submitComment = async () => {
    if (!post || !user || posting) return;
    const content = draft.trim();
    if (!content || content.length > MAX_COMMENT_LENGTH) return;
    setPosting(true);
    setNotice(null);
    try {
      const created = await withVerification(() =>
        apiJson<CommunityComment>(`/api/v1/community/posts/${post.id}/comments`, {
          method: "POST",
          body: JSON.stringify({ content }),
        }),
      );
      if (!created) {
        setNotice({ message: "Claim your free WALLORA tick to comment.", tone: "info" });
        return;
      }
      setComments((prev) => [created, ...prev]);
      setPost((prev) =>
        prev ? { ...prev, commentCount: (prev.commentCount ?? 0) + 1 } : prev,
      );
      setDraft("");
      setNotice({ message: "Comment posted.", tone: "success" });
    } catch (e: any) {
      setNotice({ message: e?.message ?? "Could not post comment.", tone: "error" });
    } finally {
      setPosting(false);
    }
  };

  const canDelete = canDeletePost(user, post);

  const performDelete = async () => {
    if (!post || !canDelete || deleting) return;
    setDeleting(true);
    setNotice(null);
    try {
      await apiJson(`/api/v1/community/posts/${post.id}`, { method: "DELETE" });
      setDeleting(false);
      router.back();
    } catch (e: any) {
      setNotice({ message: deleteErrorMessage(e), tone: "error" });
      setDeleting(false);
    }
  };

  const deletePost = () => {
    Alert.alert(
      "Delete post?",
      "This post and its comments will be removed. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void performDelete() },
      ],
    );
  };

  const image = assetUrl(post?.imageUrl);
  const media = post ? resolvePostMedia(post) : { uri: null, body: "" };
  const clipUri = media.uri;
  const isClip = !!clipUri && !image;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Community post"
        subtitle="The conversation"
        right={
          <Pressable onPress={onRefresh} hitSlop={10} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={19} color={C.accent} />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
        }
      >
        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator color={C.accent} size="large" />
            <Text style={styles.stateText}>Loading this post…</Text>
          </View>
        ) : error || !post ? (
          <View style={styles.state}>
            <Ionicons name="cloud-offline-outline" size={42} color={C.muted} />
            <Text style={styles.stateText}>Couldn’t load this post</Text>
            <Text style={styles.stateSub}>{error ?? "This post is no longer available."}</Text>
            <Pressable style={styles.primaryButton} onPress={onRefresh}>
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.postCard}>
              <AuthorLine author={post.author} createdAt={post.createdAt} />

              <Text style={styles.body}>
                {media.body || (image ? "Image shared on WALLORA" : isClip ? "Video shared on WALLORA" : "")}
              </Text>

              {isClip && clipUri ? (
                <ChannelClipCard
                  uri={clipUri}
                  title={post.channelName ?? "WALLORA video"}
                  subtitle={
                    post.channelGroup ??
                    (post.videoUrl ? "9s clip · WALLORA TV" : "Streaming on WALLORA")
                  }
                />
              ) : null}

              {image ? (
                <Image source={{ uri: image }} style={styles.postImage} resizeMode="cover" />
              ) : null}

              <View style={styles.countsRow}>
                <Ionicons name="heart-outline" size={13} color={C.muted} />
                <Text style={styles.countsText}>{countLabel(post.likeCount)} likes</Text>
                <Ionicons name="chatbubble-outline" size={13} color={C.muted} style={styles.countsIcon} />
                <Text style={styles.countsText}>
                  {countLabel(post.commentCount)} comments
                </Text>
                <Ionicons name="repeat-outline" size={13} color={C.muted} style={styles.countsIcon} />
                <Text style={styles.countsText}>{countLabel(post.repostCount)} reposts</Text>
                <Ionicons name="share-outline" size={13} color={C.muted} style={styles.countsIcon} />
                <Text style={styles.countsText}>{countLabel(post.shareCount)} shares</Text>
              </View>

              <View style={styles.actionsRow}>
                <Pressable
                  onPress={() => void toggleLike()}
                  disabled={busy}
                  style={[styles.action, post.liked && styles.actionActive]}
                >
                  <Ionicons
                    name={post.liked ? "heart" : "heart-outline"}
                    size={16}
                    color={post.liked ? C.error : C.textSoft}
                  />
                  <Text style={[styles.actionText, post.liked && { color: C.error }]}>Like</Text>
                </Pressable>
                <Pressable
                  onPress={() => void toggleRepost()}
                  disabled={busy}
                  style={[styles.action, post.reposted && styles.actionActive]}
                >
                  <Ionicons
                    name="repeat"
                    size={16}
                    color={post.reposted ? C.success : C.textSoft}
                  />
                  <Text style={[styles.actionText, post.reposted && { color: C.success }]}>
                    Repost
                  </Text>
                </Pressable>
                <Pressable onPress={() => void sharePost()} disabled={busy} style={styles.action}>
                  <Ionicons name="share-outline" size={16} color={C.textSoft} />
                  <Text style={styles.actionText}>Share</Text>
                </Pressable>
              </View>

              {canDelete ? (
                <Pressable
                  onPress={() => void deletePost()}
                  disabled={deleting}
                  style={styles.deleteButton}
                >
                  {deleting ? (
                    <ActivityIndicator color={C.error} size="small" />
                  ) : (
                    <Ionicons name="trash-outline" size={15} color={C.error} />
                  )}
                  <Text style={styles.deleteText}>Delete post</Text>
                </Pressable>
              ) : null}
            </View>

            <Banner notice={notice} />

            <View style={styles.commentsSection}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="chatbubbles-outline" size={17} color={C.accent} />
                <Text style={styles.sectionTitle}>Comments</Text>
                <Text style={styles.sectionCount}>{countLabel(post.commentCount)}</Text>
              </View>

              {user ? (
                <View style={styles.composer}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Add to the conversation…"
                    placeholderTextColor={C.muted}
                    style={styles.composerInput}
                    multiline
                    maxLength={MAX_COMMENT_LENGTH}
                    editable={!posting}
                  />
                  <View style={styles.composerFooter}>
                    <Text style={styles.counter}>
                      {MAX_COMMENT_LENGTH - draft.length} characters left
                    </Text>
                    <Pressable
                      onPress={() => void submitComment()}
                      disabled={posting || draft.trim().length === 0}
                      style={[styles.replyButton, posting && styles.buttonDisabled]}
                    >
                      {posting ? (
                        <ActivityIndicator color={C.bg} size="small" />
                      ) : (
                        <Ionicons name="send" size={14} color={C.bg} />
                      )}
                      <Text style={styles.replyButtonText}>Reply</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  style={styles.signInCard}
                  onPress={() => router.push("/auth/login")}
                >
                  <Ionicons name="log-in-outline" size={17} color={C.accent} />
                  <Text style={styles.signInText}>Sign in to comment</Text>
                  <Ionicons name="chevron-forward" size={16} color={C.accent} />
                </Pressable>
              )}

              {commentsError ? (
                <View style={styles.inlineError}>
                  <Ionicons name="alert-circle-outline" size={15} color={C.error} />
                  <Text style={styles.inlineErrorText}>{commentsError}</Text>
                  <Pressable onPress={onRefresh} hitSlop={8}>
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                </View>
              ) : null}

              {comments.length === 0 ? (
                <View style={styles.emptyComments}>
                  <Ionicons name="chatbubble-outline" size={32} color={C.muted} />
                  <Text style={styles.emptyTitle}>No replies yet</Text>
                  <Text style={styles.emptySub}>Start the conversation.</Text>
                </View>
              ) : (
                comments.map((comment) => (
                  <View key={comment.id} style={styles.commentCard}>
                    <AuthorLine author={comment.author} createdAt={comment.createdAt} />
                    <Text style={styles.commentBody}>{comment.content}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
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
  content: { padding: S.lg, paddingBottom: S.xxxl },
  state: { alignItems: "center", paddingVertical: 72, gap: S.sm },
  stateText: { fontSize: 15, fontWeight: "700", color: C.text, textAlign: "center", marginTop: 6 },
  stateSub: { fontSize: 12, color: C.muted, textAlign: "center", lineHeight: 18, paddingHorizontal: S.xl },
  primaryButton: {
    backgroundColor: C.accent,
    borderRadius: R.md,
    paddingHorizontal: S.xl,
    paddingVertical: 11,
    marginTop: S.sm,
  },
  primaryButtonText: { color: C.bg, fontWeight: "800", fontSize: 13 },
  postCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: S.md,
  },
  authorRow: { flexDirection: "row", alignItems: "center", gap: S.sm },
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
  postImage: {
    width: "100%",
    height: 210,
    borderRadius: R.md,
    marginTop: S.md,
    backgroundColor: C.raised,
  },
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
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: S.sm,
    paddingVertical: 10,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.error + "55",
    backgroundColor: C.errorDim,
  },
  deleteText: { color: C.error, fontSize: 12, fontWeight: "700" },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: S.sm,
    borderWidth: 1,
    borderRadius: R.md,
    padding: S.md,
    marginTop: S.md,
    backgroundColor: C.card,
  },
  bannerText: { flex: 1, fontSize: 12, lineHeight: 18 },
  commentsSection: { marginTop: S.xl },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: S.md },
  sectionTitle: { color: C.text, fontSize: 15, fontWeight: "800" },
  sectionCount: { color: C.muted, fontSize: 12 },
  composer: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: S.md,
    marginBottom: S.md,
  },
  composerInput: {
    minHeight: 72,
    color: C.text,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: "top",
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.borderSoft,
    borderRadius: R.md,
    padding: S.md,
  },
  composerFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: S.sm },
  counter: { color: C.muted, fontSize: 11 },
  replyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: S.md,
    paddingVertical: 9,
    borderRadius: R.md,
    backgroundColor: C.accent,
  },
  replyButtonText: { color: C.bg, fontSize: 12, fontWeight: "800" },
  buttonDisabled: { opacity: 0.6 },
  signInCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accent + "44",
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: 12,
    marginBottom: S.md,
  },
  signInText: { flex: 1, fontSize: 12, color: C.textSoft },
  inlineError: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    borderWidth: 1,
    borderColor: C.error + "55",
    borderRadius: R.md,
    backgroundColor: C.errorDim,
    padding: S.md,
    marginBottom: S.md,
  },
  inlineErrorText: { flex: 1, color: C.error, fontSize: 12 },
  retryText: { color: C.accent, fontSize: 12, fontWeight: "700" },
  emptyComments: {
    alignItems: "center",
    paddingVertical: 40,
    gap: S.sm,
    borderRadius: R.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: C.border,
    backgroundColor: C.card,
  },
  emptyTitle: { color: C.text, fontSize: 13, fontWeight: "700", marginTop: 6 },
  emptySub: { color: C.muted, fontSize: 12 },
  commentCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    padding: S.md,
    marginBottom: S.sm,
  },
  commentBody: { color: C.textSoft, fontSize: 13, lineHeight: 19, marginTop: S.sm },
});
