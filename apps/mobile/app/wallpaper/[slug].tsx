import { View, Text, StyleSheet, ScrollView, Image, Pressable, ActivityIndicator, Share, Linking, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, apiJson } from "../../lib/api";
import { assetUrl } from "../../lib/config";

const C = {
  bg: "#0B0C0F",
  card: "#14161B",
  raised: "#1C1F26",
  text: "#F7F7F5",
  muted: "#9296A1",
  accent: "#D7B879",
  border: "#292C33",
  green: "#5FB98A",
};

interface Asset { id: string; variant: string; objectKey: string; width: number; height: number; }
interface Creator { id: string; username: string; displayName: string; bio?: string | null; verified?: boolean; avatarUrl?: string | null; }
interface Comment { id: string; content: string; createdAt: string; author: { username: string; displayName: string; verified?: boolean; avatarUrl?: string | null }; }
interface Related { id: string; slug: string; title: string; orientation: string; likeCount: number; dominantColor?: string | null; asset: { objectKey: string } | null; }
interface Detail {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  orientation: string;
  dominantColor: string | null;
  license: string;
  sourceType: string;
  likeCount: number;
  favoriteCount: number;
  downloadCount: number;
  viewCount: number;
  createdAt: string;
  category: { slug: string; name: string } | null;
  creator: Creator;
  assets: Asset[];
  tags: { slug: string; name: string }[];
  liked: boolean;
  favorited: boolean;
  related: Related[];
}

export default function WallpaperDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState<number | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const notice = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  };

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<Detail>(`/api/v1/wallpapers/${slug}`);
      setDetail(data);
      const [profile, commentData] = await Promise.all([
        apiJson<any>(`/api/v1/users/${data.creator?.username}`).catch(() => null),
        apiJson<{ items: Comment[] }>(`/api/v1/wallpapers/${slug}/comments`).catch(() => ({ items: [] })),
      ]);
      if (profile) {
        setFollowing(!!profile.isFollowing);
        setFollowers(profile.stats?.followers ?? null);
      }
      setComments(commentData.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Could not load this wallpaper.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  const preview =
    detail?.assets?.find((a) => a.variant === "detail")?.objectKey ??
    detail?.assets?.find((a) => a.variant === "grid")?.objectKey;

  const toggleLike = async () => {
    if (!detail || busy) return;
    setBusy("like");
    const method = detail.liked ? "DELETE" : "POST";
    try {
      const res = await apiFetch(`/api/v1/wallpapers/${slug}/like`, { method });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed");
      setDetail({ ...detail, liked: data.data.liked, likeCount: data.data.likeCount });
    } catch (e: any) {
      notice(e?.message ?? "Could not update like");
    } finally {
      setBusy(null);
    }
  };

  const toggleFavorite = async () => {
    if (!detail || busy) return;
    setBusy("favorite");
    const method = detail.favorited ? "DELETE" : "POST";
    try {
      const res = await apiFetch(`/api/v1/wallpapers/${slug}/favorite`, { method });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed");
      setDetail({ ...detail, favorited: data.data.favorited, favoriteCount: data.data.favoriteCount });
      notice(data.data.favorited ? "Saved to favorites" : "Removed from favorites");
    } catch (e: any) {
      notice(e?.message ?? "Could not update favorite");
    } finally {
      setBusy(null);
    }
  };

  const toggleFollow = async () => {
    if (!detail?.creator?.username || busy) return;
    setBusy("follow");
    try {
      const res = await apiFetch(`/api/v1/users/${detail.creator.username}/follow`, {
        method: following ? "DELETE" : "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed");
      setFollowing(data.data.following);
      setFollowers((n) => (n == null ? n : n + (data.data.following ? 1 : -1)));
      notice(data.data.following ? `Following ${detail.creator.displayName}` : "Unfollowed");
    } catch (e: any) {
      notice(e?.message ?? "Could not update follow");
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    if (!detail) return;
    const url = assetUrl(preview) ?? `${C.bg}`;
    try {
      await Share.share({
        title: detail.title,
        message: `${detail.title} — find it on WALLORA`,
        url,
      });
    } catch {
      /* user cancelled */
    }
  };

  const download = async () => {
    if (!detail || busy) return;
    setBusy("download");
    try {
      const data = await apiJson<{ url: string; filename: string; mimeType: string }>(
        `/api/v1/wallpapers/${slug}/download`,
        { method: "POST" },
      );
      const url = assetUrl(data.url);
      setDetail({ ...detail, downloadCount: detail.downloadCount + 1 });
      if (url) {
        try {
          await Share.share({ title: data.filename, message: `Save ${data.filename}`, url });
        } catch {
          await Linking.openURL(url).catch(() => {});
        }
      }
      notice("Download ready");
    } catch (e: any) {
      notice(e?.message ?? "Could not download");
    } finally {
      setBusy(null);
    }
  };

  const submitComment = async () => {
    if (!comment.trim() || !slug || posting) return;
    setPosting(true);
    try {
      const data = await apiJson<Comment>(`/api/v1/wallpapers/${slug}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: comment.trim() }),
      });
      setComments((c) => [data, ...c]);
      setComment("");
      notice("Comment posted");
    } catch (e: any) {
      notice(e?.message ?? "Could not post comment");
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.accent} size="large" />
        <Text style={styles.loadingText}>Opening wallpaper…</Text>
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <Ionicons name="alert-circle-outline" size={44} color={C.muted} />
        <Text style={styles.errorText}>{error ?? "Wallpaper not found"}</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const initial = (detail.creator.displayName ?? "?").slice(0, 1).toUpperCase();
  const ratio = detail.assets?.[0]?.width && detail.assets?.[0]?.height
    ? detail.assets[0].height / detail.assets[0].width
    : 1.2;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Preview */}
        <View style={styles.previewWrap}>
          {assetUrl(preview) ? (
            <Image source={{ uri: assetUrl(preview) }} style={[styles.preview, { aspectRatio: 1 / ratio }]} resizeMode="cover" />
          ) : (
            <View style={[styles.preview, { backgroundColor: detail.dominantColor ?? C.raised, aspectRatio: 1 / ratio }]} />
          )}
          <View style={styles.previewShade} />
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={C.text} />
          </Pressable>
          <Pressable style={styles.shareFloat} onPress={share}>
            <Ionicons name="share-outline" size={18} color={C.text} />
          </Pressable>
          <View style={styles.previewCaption}>
            <Text style={styles.previewEyebrow}>{detail.category?.name ?? "WALLORA"} · {detail.orientation.toUpperCase()}</Text>
            <Text style={styles.previewTitle}>{detail.title}</Text>
          </View>
        </View>

        {/* Creator */}
        <View style={styles.creatorRow}>
          <View style={styles.avatar}>
            {detail.creator.avatarUrl ? (
              <Image source={{ uri: assetUrl(detail.creator.avatarUrl) }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.creatorNameRow}>
              <Text style={styles.creatorName}>{detail.creator.displayName}</Text>
              {detail.creator.verified && <Ionicons name="checkmark-circle" size={15} color={C.accent} />}
            </View>
            <Text style={styles.creatorMeta}>
              @{detail.creator.username}{followers != null ? ` · ${followers} followers` : ""}
            </Text>
          </View>
          <Pressable
            style={[styles.followBtn, following && styles.followingBtn]}
            onPress={toggleFollow}
            disabled={busy === "follow"}
          >
            {busy === "follow" ? (
              <ActivityIndicator size="small" color={C.bg} />
            ) : (
              <Text style={[styles.followBtnText, following && styles.followingBtnText]}>
                {following ? "Following" : "Follow"}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable style={[styles.actionBtn, detail.liked && styles.actionBtnActive]} onPress={toggleLike} disabled={busy === "like"}>
            <Ionicons name={detail.liked ? "heart" : "heart-outline"} size={20} color={detail.liked ? C.accent : C.text} />
            <Text style={[styles.actionText, detail.liked && styles.actionTextActive]}>{detail.likeCount}</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, detail.favorited && styles.actionBtnActive]} onPress={toggleFavorite} disabled={busy === "favorite"}>
            <Ionicons name={detail.favorited ? "bookmark" : "bookmark-outline"} size={20} color={detail.favorited ? C.accent : C.text} />
            <Text style={[styles.actionText, detail.favorited && styles.actionTextActive]}>Save</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={share}>
            <Ionicons name="share-outline" size={20} color={C.text} />
            <Text style={styles.actionText}>Share</Text>
          </Pressable>
          <Pressable style={styles.downloadBtn} onPress={download} disabled={busy === "download"}>
            {busy === "download" ? (
              <ActivityIndicator size="small" color={C.bg} />
            ) : (
              <>
                <Ionicons name="download-outline" size={19} color={C.bg} />
                <Text style={styles.downloadText}>Download</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About this wallpaper</Text>
          {detail.description ? <Text style={styles.description}>{detail.description}</Text> : null}
          <View style={styles.tagRow}>
            {detail.tags?.slice(0, 6).map((tag) => (
              <View key={tag.slug} style={styles.tag}>
                <Text style={styles.tagText}>#{tag.name}</Text>
              </View>
            ))}
          </View>
          <View style={styles.factRow}>
            <Fact label="Resolution" value={detail.assets?.[0] ? `${detail.assets[0].width} × ${detail.assets[0].height}` : "—"} />
            <Fact label="Downloads" value={String(detail.downloadCount)} />
            <Fact label="Views" value={String(detail.viewCount)} />
          </View>
          <Text style={styles.license}>License: {detail.license}</Text>
        </View>

        {/* Comments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conversation <Text style={styles.count}>({comments.length})</Text></Text>
          <View style={styles.commentComposer}>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Add a comment…"
              placeholderTextColor={C.muted}
              style={styles.commentInput}
              maxLength={500}
              multiline
            />
            <Pressable style={styles.sendBtn} onPress={submitComment} disabled={posting || !comment.trim()}>
              {posting ? <ActivityIndicator size="small" color={C.bg} /> : <Ionicons name="send" size={17} color={C.bg} />}
            </Pressable>
          </View>
          {comments.length === 0 ? (
            <Text style={styles.noComments}>Be the first to leave a comment.</Text>
          ) : (
            comments.slice(0, 20).map((c) => (
              <View key={c.id} style={styles.comment}>
                <View style={styles.commentAvatar}>
                  <Text style={styles.commentAvatarText}>{(c.author.displayName ?? "?").slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.commentHead}>
                    <Text style={styles.commentAuthor}>{c.author.displayName}</Text>
                    {c.author.verified && <Ionicons name="checkmark-circle" size={12} color={C.accent} />}
                  </View>
                  <Text style={styles.commentBody}>{c.content}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Related */}
        {detail.related?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>More like this</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedRow}>
              {detail.related.map((r) => (
                <Pressable
                  key={r.id}
                  style={styles.relatedCard}
                  onPress={() => router.push({ pathname: "/wallpaper/[slug]", params: { slug: r.slug } })}
                >
                  {r.asset?.objectKey ? (
                    <Image source={{ uri: assetUrl(r.asset.objectKey) }} style={styles.relatedImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.relatedImage, { backgroundColor: r.dominantColor ?? C.raised }]} />
                  )}
                  <Text style={styles.relatedTitle} numberOfLines={1}>{r.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {toast && (
        <View style={styles.toast}>
          <Ionicons name="checkmark-circle" size={17} color={C.green} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: C.muted, fontSize: 14 },
  errorText: { color: C.text, fontSize: 15, fontWeight: "600", textAlign: "center", paddingHorizontal: 30 },
  primaryBtn: { backgroundColor: C.accent, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  primaryBtnText: { color: C.bg, fontWeight: "700" },
  previewWrap: { position: "relative", width: "100%", backgroundColor: C.raised },
  preview: { width: "100%", maxHeight: 520 },
  previewShade: { position: "absolute", left: 0, right: 0, top: 0, height: 140, backgroundColor: "rgba(0,0,0,0.35)" },
  backBtn: { position: "absolute", top: 44, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(11,12,15,0.65)", alignItems: "center", justifyContent: "center" },
  shareFloat: { position: "absolute", top: 44, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(11,12,15,0.65)", alignItems: "center", justifyContent: "center" },
  previewCaption: { position: "absolute", bottom: 16, left: 18, right: 18 },
  previewEyebrow: { color: C.accent, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 4 },
  previewTitle: { color: C.text, fontSize: 27, fontWeight: "700" },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: 46, height: 46 },
  avatarText: { color: C.bg, fontSize: 20, fontWeight: "800" },
  creatorNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  creatorName: { color: C.text, fontSize: 15, fontWeight: "700" },
  creatorMeta: { color: C.muted, fontSize: 12, marginTop: 2 },
  followBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: C.accent, minWidth: 88, alignItems: "center" },
  followingBtn: { backgroundColor: C.raised, borderColor: C.border },
  followBtnText: { color: C.accent, fontWeight: "700", fontSize: 12 },
  followingBtnText: { color: C.muted },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12 },
  actionBtnActive: { borderColor: C.accent, backgroundColor: "rgba(215,184,121,0.08)" },
  actionText: { color: C.text, fontSize: 12, fontWeight: "600" },
  actionTextActive: { color: C.accent },
  downloadBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 13 },
  downloadText: { color: C.bg, fontWeight: "800", fontSize: 13 },
  section: { paddingHorizontal: 16, paddingTop: 18 },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: "700", marginBottom: 10 },
  count: { color: C.muted, fontSize: 13, fontWeight: "500" },
  description: { color: C.muted, fontSize: 14, lineHeight: 21 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  tag: { backgroundColor: C.card, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: C.border },
  tagText: { color: C.accent, fontSize: 11 },
  factRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  fact: { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
  factLabel: { color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.7 },
  factValue: { color: C.text, fontSize: 13, fontWeight: "700", marginTop: 4 },
  license: { color: C.muted, fontSize: 11, marginTop: 12 },
  commentComposer: { flexDirection: "row", gap: 8, alignItems: "flex-end", marginBottom: 14 },
  commentInput: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, color: C.text, fontSize: 13, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  noComments: { color: C.muted, fontSize: 13, fontStyle: "italic" },
  comment: { flexDirection: "row", gap: 10, marginBottom: 14 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.raised, alignItems: "center", justifyContent: "center" },
  commentAvatarText: { color: C.accent, fontWeight: "700", fontSize: 13 },
  commentHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  commentAuthor: { color: C.text, fontSize: 13, fontWeight: "700" },
  commentBody: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  relatedRow: { gap: 10 },
  relatedCard: { width: 132 },
  relatedImage: { width: 132, height: 96, borderRadius: 10, backgroundColor: C.raised },
  relatedTitle: { color: C.text, fontSize: 12, fontWeight: "600", marginTop: 6 },
  toast: { position: "absolute", bottom: 30, left: 20, right: 20, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 13 },
  toastText: { color: C.text, fontSize: 13, fontWeight: "600" },
});
