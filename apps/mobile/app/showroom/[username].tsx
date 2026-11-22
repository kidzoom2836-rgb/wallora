import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  Linking,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { VerifiedBadge } from "../../components/ui/VerifiedBadge";
import { apiJson } from "../../lib/api";
import { API_BASE, assetUrl } from "../../lib/config";
import { C, R, S } from "../../lib/theme";

type ShowroomItem = {
  id: string;
  type?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  href?: string | null;
  wallpaperSlug?: string | null;
  projectId?: string | null;
  caption?: string | null;
};

type Showroom = {
  username: string;
  headline?: string | null;
  description?: string | null;
  updatedAt?: string;
  itemCount?: number;
  owner?: {
    username?: string;
    displayName?: string;
    avatarUrl?: string | null;
    tier?: string | null;
    userId?: string | null;
  } | null;
  items: ShowroomItem[];
};

function dateLabel(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ShowroomDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const username = Array.isArray(params.username) ? params.username[0] : params.username ?? "";
  const [room, setRoom] = useState<Showroom | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!username) {
      setError("No showroom was specified.");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await apiJson<Showroom>(
        `/api/v1/showroom/${encodeURIComponent(username)}`,
      );
      setRoom(data);
    } catch (e: any) {
      setError(e?.message ?? "Could not load this showroom.");
      setRoom(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [username]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const openItem = (item: ShowroomItem) => {
    if (item.wallpaperSlug) {
      router.push({ pathname: "/wallpaper/[slug]", params: { slug: item.wallpaperSlug } });
      return;
    }
    if (item.projectId) {
      router.push({ pathname: "/project/[id]", params: { id: item.projectId } });
      return;
    }
    if (item.href) {
      void Linking.openURL(`${API_BASE}${item.href.startsWith("/") ? "" : "/"}${item.href}`).catch(() => {});
    }
  };

  const items = Array.isArray(room?.items) ? room!.items : [];
  const ownerName = room?.owner?.displayName ?? room?.username ?? username ?? "WALLORA creator";

  return (
    <View style={styles.root}>
      <ScreenHeader title="Showroom" subtitle={room ? `@${room.username}` : "Loading showroom"} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={C.accent}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            {loading ? (
              <View style={styles.inlineState}>
                <ActivityIndicator color={C.accent} size="small" />
                <Text style={styles.stateSub}>Loading this showroom…</Text>
              </View>
            ) : null}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={18} color={C.error} />
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => { setLoading(true); void load(); }}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </View>
            ) : null}
            {room ? (
              <>
                <View style={styles.ownerRow}>
                  <View style={styles.avatar}>
                    {assetUrl(room.owner?.avatarUrl) ? (
                      <Image source={{ uri: assetUrl(room.owner?.avatarUrl) }} style={styles.avatarImage} />
                    ) : (
                      <Ionicons name="person-outline" size={20} color={C.accent} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.ownerName} numberOfLines={1}>
                        {ownerName}
                      </Text>
                      <VerifiedBadge tier={room.owner?.tier} size="sm" />
                    </View>
                    <Text style={styles.handle}>@{room.username}</Text>
                  </View>
                </View>

                <Text style={styles.headline}>{room.headline ?? `@${room.username}`}</Text>
                {room.description ? <Text style={styles.description}>{room.description}</Text> : null}

                <View style={styles.stats}>
                  <View style={styles.stat}>
                    <Ionicons name="grid-outline" size={15} color={C.accent} />
                    <Text style={styles.statText}>{room.itemCount ?? items.length} items</Text>
                  </View>
                  <View style={styles.stat}>
                    <Ionicons name="time-outline" size={15} color={C.muted} />
                    <Text style={styles.statText}>Updated {dateLabel(room.updatedAt) || "recently"}</Text>
                  </View>
                </View>

                <Text style={styles.sectionLabel}>GALLERY</Text>
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <View style={styles.state}>
              <Ionicons name="images-outline" size={40} color={C.muted} />
              <Text style={styles.stateText}>This showroom is empty</Text>
              <Text style={styles.stateSub}>Its owner has not added any items yet.</Text>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => {
          const uri = assetUrl(item.imageUrl);
          return (
            <Pressable
              onPress={() => openItem(item)}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            >
              <View style={styles.tileImageWrap}>
                {uri ? (
                  <Image source={{ uri }} style={styles.tileImage} resizeMode="cover" />
                ) : (
                  <View style={styles.tileFallback}>
                    <Ionicons name="image-outline" size={24} color={C.mutedDark} />
                  </View>
                )}
              </View>
              <View style={styles.tileFooter}>
                <Text style={styles.tileTitle} numberOfLines={2}>
                  {item.title ?? item.caption ?? item.type ?? "Showroom item"}
                </Text>
                <Ionicons name="open-outline" size={13} color={C.accent} />
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  list: { paddingHorizontal: S.lg, paddingBottom: S.xxxl },
  headerBlock: { paddingTop: S.lg },
  ownerRow: { flexDirection: "row", alignItems: "center", gap: S.sm },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 46, height: 46 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ownerName: { fontSize: 16, fontWeight: "800", color: C.text, flexShrink: 1 },
  handle: { fontSize: 12, color: C.muted, marginTop: 2 },
  headline: { fontSize: 22, fontWeight: "800", color: C.text, marginTop: S.lg },
  description: { fontSize: 13, color: C.textSoft, lineHeight: 20, marginTop: S.sm },
  stats: { flexDirection: "row", gap: S.lg, marginTop: S.md },
  stat: { flexDirection: "row", alignItems: "center", gap: 6 },
  statText: { fontSize: 12, color: C.muted },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: "800",
    color: C.accent,
    marginTop: S.xl,
    marginBottom: S.sm,
  },
  gridRow: { gap: S.sm, marginBottom: S.sm },
  tile: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    overflow: "hidden",
  },
  tilePressed: { opacity: 0.8 },
  tileImageWrap: { width: "100%", aspectRatio: 0.8, backgroundColor: C.raised },
  tileImage: { width: "100%", height: "100%" },
  tileFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  tileFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.xs,
    padding: S.sm,
  },
  tileTitle: { flex: 1, fontSize: 12, fontWeight: "700", color: C.text },
  inlineState: { flexDirection: "row", alignItems: "center", gap: S.sm },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: S.sm,
    backgroundColor: C.errorDim,
    borderWidth: 1,
    borderColor: C.error + "55",
    borderRadius: R.md,
    padding: S.md,
  },
  errorText: { flex: 1, color: C.error, fontSize: 12 },
  retryText: { color: C.accent, fontSize: 12, fontWeight: "800" },
  state: { alignItems: "center", paddingVertical: 72, gap: S.sm },
  stateText: { fontSize: 15, fontWeight: "700", color: C.text, textAlign: "center", marginTop: 6 },
  stateSub: { fontSize: 12, color: C.muted, textAlign: "center", paddingHorizontal: S.xl, lineHeight: 18 },
});
