import { View, Text, StyleSheet, FlatList, Pressable, Image, ActivityIndicator, RefreshControl } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiJson } from "../lib/api";
import { assetUrl } from "../lib/config";

const C = { bg: "#0B0C0F", card: "#14161B", raised: "#1C1F26", text: "#F7F7F5", muted: "#9296A1", accent: "#D7B879", border: "#292C33" };

interface Favorite {
  favoritedAt: string;
  wallpaper: {
    id: string;
    slug: string;
    title: string;
    orientation: string;
    dominantColor: string | null;
    likeCount: number;
    downloadCount: number;
    category: { slug: string; name: string } | null;
    creator: { username: string; displayName: string; verified?: boolean };
    asset: { objectKey: string; width: number; height: number } | null;
  };
}

export default function FavoritesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiJson<{ items: Favorite[] }>("/api/v1/favorites?limit=24");
      setItems(data.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Could not load favorites.");
    }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={21} color={C.text} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>My Space</Text>
          <Text style={styles.sub}>Wallpapers you saved</Text>
        </View>
        <Ionicons name="bookmarks-outline" size={21} color={C.accent} />
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.wallpaper.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.accent} />}
        ListEmptyComponent={
          loading ? <View style={styles.state}><ActivityIndicator color={C.accent} /></View> : (
            <View style={styles.state}>
              <Ionicons name="bookmark-outline" size={44} color={C.muted} />
              <Text style={styles.stateTitle}>{error ?? "Nothing saved yet"}</Text>
              <Text style={styles.stateSub}>Tap the bookmark on any wallpaper to keep it here.</Text>
              <Pressable style={styles.cta} onPress={() => router.push("/(tabs)/discover")}>
                <Text style={styles.ctaText}>Explore wallpapers</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => {
          const w = item.wallpaper;
          return (
            <Pressable style={styles.card} onPress={() => router.push({ pathname: "/wallpaper/[slug]", params: { slug: w.slug } })}>
              <View style={styles.imageWrap}>
                {assetUrl(w.asset?.objectKey) ? (
                  <Image source={{ uri: assetUrl(w.asset?.objectKey) }} style={styles.image} resizeMode="cover" />
                ) : (
                  <View style={[styles.image, { backgroundColor: w.dominantColor ?? C.raised }]} />
                )}
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.cardTitle} numberOfLines={1}>{w.title}</Text>
                <Text style={styles.cardSub} numberOfLines={1}>{w.creator.displayName}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 50, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { padding: 4 },
  title: { color: C.text, fontSize: 20, fontWeight: "700" },
  sub: { color: C.muted, fontSize: 12, marginTop: 2 },
  content: { padding: 16, paddingBottom: 40 },
  gridRow: { gap: 12, marginBottom: 12 },
  card: { flex: 1, backgroundColor: C.card, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  imageWrap: { height: 150, backgroundColor: C.raised },
  image: { width: "100%", height: "100%" },
  cardFooter: { padding: 10 },
  cardTitle: { color: C.text, fontSize: 13, fontWeight: "700" },
  cardSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  state: { alignItems: "center", paddingTop: 80, gap: 9 },
  stateTitle: { color: C.text, fontSize: 16, fontWeight: "700", textAlign: "center" },
  stateSub: { color: C.muted, fontSize: 12, textAlign: "center", paddingHorizontal: 40, lineHeight: 18 },
  cta: { marginTop: 8, backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 },
  ctaText: { color: C.bg, fontWeight: "700", fontSize: 13 },
});
