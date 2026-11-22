import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ScreenHeader } from "../components/ui/ScreenHeader";
import { VerifiedBadge } from "../components/ui/VerifiedBadge";
import { apiJson } from "../lib/api";
import { assetUrl } from "../lib/config";
import { C, R, S } from "../lib/theme";

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

type Pagination = { page?: number; limit?: number; total?: number; totalPages?: number };
type ShowroomList = { items: Showroom[]; pagination: Pagination };

const PAGE_SIZE = 18;

function dateLabel(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ShowroomScreen() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Showroom[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      setError(null);
      if (nextPage > 1) setLoadingMore(true);
      try {
        const params = new URLSearchParams({ page: String(nextPage), limit: String(PAGE_SIZE) });
        if (search) params.set("q", search);
        const data = await apiJson<ShowroomList>(`/api/v1/showroom?${params.toString()}`);
        const items = Array.isArray(data?.items) ? data.items : [];
        setRooms((prev) => (replace ? items : [...prev, ...items]));
        setPage(data?.pagination?.page ?? nextPage);
        setTotalPages(data?.pagination?.totalPages ?? 1);
      } catch (e: any) {
        setError(e?.message ?? "Could not load showrooms.");
        if (replace) setRooms([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [search],
  );

  useEffect(() => {
    setLoading(true);
    void load(1, true);
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load(1, true);
  }, [load]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Showroom"
        subtitle="Curated galleries from WALLORA creators"
        right={
          <Pressable onPress={onRefresh} hitSlop={10} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={19} color={C.accent} />
          </Pressable>
        }
      />
      <FlatList
        data={rooms}
        keyExtractor={(item, index) => `${item.username || "room"}-${index}`}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text style={styles.eyebrow}>SHOWROOM</Text>
            <Text style={styles.title}>Spaces worth exploring</Text>
            <Text style={styles.subtitle}>
              Real galleries built from approved wallpapers and projects — nothing generated for display.
            </Text>
            <View style={styles.search}>
              <Ionicons name="search-outline" size={17} color={C.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search showrooms…"
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
            {error && rooms.length === 0 ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.state}>
              <ActivityIndicator color={C.accent} size="large" />
              <Text style={styles.stateText}>Loading showrooms…</Text>
            </View>
          ) : (
            <View style={styles.state}>
              <Ionicons name="images-outline" size={42} color={C.muted} />
              <Text style={styles.stateText}>{error ? "Couldn’t load showrooms" : "No showrooms found"}</Text>
              <Text style={styles.stateSub}>{error ?? (search ? "Try a different search." : "Showrooms appear here once creators publish them.")}</Text>
              <Pressable style={styles.primaryButton} onPress={onRefresh}>
                <Text style={styles.primaryButtonText}>Try again</Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          rooms.length > 0 ? (
            <View style={styles.footer}>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {page < totalPages ? (
                <Pressable
                  onPress={() => void load(page + 1, false)}
                  disabled={loadingMore}
                  style={[styles.secondaryButton, loadingMore && styles.buttonDisabled]}
                >
                  {loadingMore ? (
                    <ActivityIndicator color={C.accent} size="small" />
                  ) : (
                    <Text style={styles.secondaryButtonText}>Load more</Text>
                  )}
                </Pressable>
              ) : (
                <Text style={styles.endText}>All showrooms loaded</Text>
              )}
            </View>
          ) : undefined
        }
        renderItem={({ item }) => {
          const preview = (Array.isArray(item.items) ? item.items : []).slice(0, 4);
          const ownerName = item.owner?.displayName ?? item.username ?? "WALLORA creator";
          return (
            <Pressable
              onPress={() => router.push({ pathname: "/showroom/[username]", params: { username: item.username } })}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  {assetUrl(item.owner?.avatarUrl) ? (
                    <Image source={{ uri: assetUrl(item.owner?.avatarUrl) }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="person-outline" size={18} color={C.accent} />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.ownerRow}>
                    <Text style={styles.ownerName} numberOfLines={1}>
                      {ownerName}
                    </Text>
                    <VerifiedBadge tier={item.owner?.tier} size="sm" />
                  </View>
                  <Text style={styles.handle} numberOfLines={1}>
                    @{item.username}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.muted} />
              </View>

              <Text style={styles.headline} numberOfLines={2}>
                {item.headline ?? `@${item.username}`}
              </Text>
              {item.description ? (
                <Text style={styles.description} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              {preview.length > 0 ? (
                <View style={styles.previewGrid}>
                  {preview.map((entry) => {
                    const uri = assetUrl(entry.imageUrl);
                    return (
                      <View key={entry.id} style={styles.previewTile}>
                        {uri ? (
                          <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" />
                        ) : (
                          <View style={styles.previewFallback}>
                            <Ionicons name="image-outline" size={16} color={C.mutedDark} />
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : null}

              <View style={styles.cardFooter}>
                <View style={styles.footerStat}>
                  <Ionicons name="grid-outline" size={13} color={C.accent} />
                  <Text style={styles.footerText}>{item.itemCount ?? item.items?.length ?? 0} items</Text>
                </View>
                <View style={styles.footerStat}>
                  <Ionicons name="time-outline" size={13} color={C.muted} />
                  <Text style={styles.footerText}>Updated {dateLabel(item.updatedAt) || "recently"}</Text>
                </View>
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
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: R.md,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { paddingHorizontal: S.lg, paddingBottom: S.xxxl },
  intro: { paddingTop: S.lg },
  eyebrow: { fontSize: 10, letterSpacing: 1.6, color: C.accent, fontWeight: "800", marginBottom: 4 },
  title: { fontSize: 26, fontWeight: "800", color: C.text },
  subtitle: { fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 18 },
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
    marginTop: S.lg,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 14, paddingVertical: 0 },
  error: { color: C.error, fontSize: 12, marginTop: S.sm },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: S.md,
    marginTop: S.md,
  },
  cardPressed: { backgroundColor: C.raised },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: S.sm },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 38, height: 38 },
  ownerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ownerName: { fontSize: 14, fontWeight: "700", color: C.text, flexShrink: 1 },
  handle: { fontSize: 11, color: C.muted, marginTop: 2 },
  headline: { fontSize: 16, fontWeight: "800", color: C.text, marginTop: S.md },
  description: { fontSize: 12, color: C.muted, lineHeight: 18, marginTop: 4 },
  previewGrid: { flexDirection: "row", gap: S.xs, marginTop: S.md },
  previewTile: { flex: 1, aspectRatio: 1, borderRadius: R.sm, overflow: "hidden", backgroundColor: C.raised },
  previewImage: { width: "100%", height: "100%" },
  previewFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: S.sm,
    marginTop: S.md,
    paddingTop: S.sm,
    borderTopWidth: 1,
    borderTopColor: C.borderSoft,
  },
  footerStat: { flexDirection: "row", alignItems: "center", gap: 5 },
  footerText: { fontSize: 11, color: C.muted },
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
