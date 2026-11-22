import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Image, ActivityIndicator, RefreshControl, FlatList } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiJson } from "../../lib/api";
import { assetUrl } from "../../lib/config";

const C = {
  bg: "#0B0C0F",
  card: "#14161B",
  raised: "#1C1F26",
  text: "#F7F7F5",
  muted: "#9296A1",
  accent: "#D7B879",
  border: "#292C33",
};

interface WallpaperAsset {
  objectKey: string;
  width: number;
  height: number;
}

export interface Wallpaper {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  orientation?: string;
  dominantColor?: string;
  likeCount?: number;
  favoriteCount?: number;
  downloadCount?: number;
  viewCount?: number;
  category?: { slug: string; name: string } | null;
  creator?: { id: string; username: string; displayName: string; verified?: boolean } | null;
  asset?: WallpaperAsset | null;
  liked?: boolean;
  favorited?: boolean;
}

interface Category {
  slug: string;
  name: string;
  wallpaperCount: number;
}

const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "popular", label: "Popular" },
  { id: "downloads", label: "Downloads" },
  { id: "likes", label: "Likes" },
];

export default function DiscoverScreen() {
  const router = useRouter();
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    apiJson<Category[]>("/api/v1/categories")
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({ page: "1", limit: "24", sort });
    if (category) params.set("category", category);
    if (debouncedQuery) params.set("q", debouncedQuery);
    try {
      const data = await apiJson<{ items: Wallpaper[]; pagination: { total: number } }>(
        `/api/v1/wallpapers?${params.toString()}`,
      );
      setWallpapers(data.items ?? []);
      setTotal(data.pagination?.total ?? data.items?.length ?? 0);
    } catch (e: any) {
      setError(e?.message ?? "Could not load wallpapers.");
      setWallpapers([]);
    }
  }, [category, sort, debouncedQuery]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={wallpapers}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.eyebrow}>WALLORA LIBRARY</Text>
                <Text style={styles.title}>Discover</Text>
                <Text style={styles.subtitle}>{total ? `${total} curated visuals` : "Curated visuals for every screen"}</Text>
              </View>
              <View style={styles.mark}>
                <Ionicons name="compass" size={22} color={C.accent} />
              </View>
            </View>

            <View style={styles.search}>
              <Ionicons name="search-outline" size={18} color={C.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search wallpapers, tags, creators…"
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

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <Pressable onPress={() => setCategory("")} style={[styles.chip, !category && styles.chipActive]}>
                <Text style={[styles.chipText, !category && styles.chipTextActive]}>All</Text>
              </Pressable>
              {categories.map((c) => (
                <Pressable key={c.slug} onPress={() => setCategory(c.slug)} style={[styles.chip, category === c.slug && styles.chipActive]}>
                  <Text style={[styles.chipText, category === c.slug && styles.chipTextActive]}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
              <Text style={styles.sortLabel}>Sort</Text>
              {SORTS.map((s) => (
                <Pressable key={s.id} onPress={() => setSort(s.id)} style={[styles.sortChip, sort === s.id && styles.sortChipActive]}>
                  <Text style={[styles.sortText, sort === s.id && styles.sortTextActive]}>{s.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.state}>
              <ActivityIndicator color={C.accent} size="large" />
              <Text style={styles.stateText}>Loading the collection…</Text>
            </View>
          ) : error ? (
            <View style={styles.state}>
              <Ionicons name="cloud-offline-outline" size={44} color={C.muted} />
              <Text style={styles.stateText}>Couldn’t reach WALLORA</Text>
              <Text style={styles.stateSub}>{error}</Text>
              <Pressable style={styles.retry} onPress={onRefresh}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.state}>
              <Ionicons name="images-outline" size={44} color={C.muted} />
              <Text style={styles.stateText}>No wallpapers found</Text>
              <Text style={styles.stateSub}>Try another search or category.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push({ pathname: "/wallpaper/[slug]", params: { slug: item.slug } })}
          >
            <View style={styles.imageWrap}>
              {assetUrl(item.asset?.objectKey) ? (
                <Image source={{ uri: assetUrl(item.asset?.objectKey) }} style={styles.cardImage} resizeMode="cover" />
              ) : (
                <View style={[styles.cardImage, { backgroundColor: item.dominantColor ?? C.raised }]} />
              )}
              <View style={styles.imageShade} />
              {item.orientation === "portrait" && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>PHONE</Text>
                </View>
              )}
              {item.creator?.verified && (
                <View style={styles.verified}>
                  <Ionicons name="checkmark-circle" size={15} color={C.accent} />
                </View>
              )}
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.cardCreator} numberOfLines={1}>{item.creator?.displayName ?? item.category?.name ?? "WALLORA"}</Text>
              <View style={styles.cardMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="heart-outline" size={12} color={C.muted} />
                  <Text style={styles.metaText}>{item.likeCount ?? 0}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="download-outline" size={12} color={C.muted} />
                  <Text style={styles.metaText}>{item.downloadCount ?? 0}</Text>
                </View>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  eyebrow: { fontSize: 10, letterSpacing: 1.8, color: C.accent, fontWeight: "700", marginBottom: 4 },
  title: { fontSize: 30, fontWeight: "700", color: C.text },
  subtitle: { fontSize: 13, color: C.muted, marginTop: 3 },
  mark: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  search: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  searchInput: { flex: 1, color: C.text, fontSize: 14 },
  chipRow: { gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.muted, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: C.bg, fontWeight: "700" },
  sortRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  sortLabel: { color: C.muted, fontSize: 12, marginRight: 2 },
  sortChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  sortChipActive: { borderColor: C.accent },
  sortText: { color: C.muted, fontSize: 11, fontWeight: "600" },
  sortTextActive: { color: C.accent },
  gridRow: { gap: 12, marginBottom: 12 },
  card: { flex: 1, backgroundColor: C.card, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  imageWrap: { height: 160, backgroundColor: C.raised, position: "relative" },
  cardImage: { width: "100%", height: "100%" },
  imageShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 50, backgroundColor: "rgba(0,0,0,0.28)" },
  badge: { position: "absolute", left: 8, top: 8, backgroundColor: "rgba(11,12,15,0.78)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { color: C.accent, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  verified: { position: "absolute", right: 8, top: 8 },
  cardFooter: { padding: 10 },
  cardTitle: { fontSize: 13, fontWeight: "700", color: C.text },
  cardCreator: { fontSize: 11, color: C.muted, marginTop: 2 },
  cardMeta: { flexDirection: "row", gap: 12, marginTop: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 11, color: C.muted },
  state: { alignItems: "center", paddingVertical: 70, gap: 8 },
  stateText: { color: C.text, fontSize: 15, fontWeight: "600", marginTop: 6 },
  stateSub: { color: C.muted, fontSize: 12, textAlign: "center", paddingHorizontal: 30 },
  retry: { marginTop: 10, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: C.accent },
  retryText: { color: C.bg, fontWeight: "700", fontSize: 13 },
});
