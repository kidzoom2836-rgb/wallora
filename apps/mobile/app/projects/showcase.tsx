import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Image, ActivityIndicator, RefreshControl } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiJson } from "../../lib/api";
import { assetUrl } from "../../lib/config";
import { coverImage, STATUS_LABEL, type ProjectAsset } from "../../lib/projects";

const C = { bg: "#0B0C0F", card: "#14161B", raised: "#1C1F26", text: "#F7F7F5", muted: "#9296A1", accent: "#D7B879", border: "#292C33", green: "#5FB98A", error: "#E46F75" };

type ShowcaseItem = {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  assets: ProjectAsset[];
  assetCount: number;
  noteCount: number;
  shoutoutCount: number;
  meta: { status: keyof typeof STATUS_LABEL; progress: number };
  owner: { username: string | null; displayName: string | null; verified: boolean; tier: "free" | "verified" | "premium" };
};

export default function ProjectShowcaseScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "36" });
      if (debounced) params.set("q", debounced);
      const data = await apiJson<{ items: ShowcaseItem[] }>(`/api/v1/projects/showcase?${params.toString()}`);
      setItems(data.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Could not load showcases.");
      setItems([]);
    }
  }, [debounced]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={21} color={C.text} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Community showcases</Text>
          <Text style={styles.sub}>Real projects from WALLORA creators</Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.accent} />}
      >
        <View style={styles.search}>
          <Ionicons name="search-outline" size={17} color={C.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search projects" placeholderTextColor={C.muted} style={styles.searchInput} />
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
        {loading ? (
          <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="layers-outline" size={42} color={C.muted} />
            <Text style={styles.emptyTitle}>No public showcases yet</Text>
            <Text style={styles.emptySub}>Public projects will appear here for the community to explore.</Text>
          </View>
        ) : (
          items.map((item) => {
            const image = assetUrl(coverImage(item));
            const owner = item.owner?.displayName || item.owner?.username || "WALLORA creator";
            return (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/showcase/${item.id}`)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <View style={styles.cover}>
                  {image ? <Image source={{ uri: image }} style={styles.coverImage} resizeMode="cover" /> : <Ionicons name="folder-open-outline" size={26} color={C.accent} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.owner}>by {owner}</Text>
                  <Text style={styles.desc} numberOfLines={2}>{item.description ?? "A creative WALLORA project."}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>{STATUS_LABEL[item.meta?.status] ?? "Planning"}</Text>
                    <Text style={styles.dot}>·</Text>
                    <Text style={styles.meta}>{item.meta?.progress ?? 0}%</Text>
                    <Text style={styles.dot}>·</Text>
                    <Text style={styles.meta}>{item.shoutoutCount ?? 0} shouts</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.muted} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 50, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { padding: 4 },
  title: { color: C.text, fontSize: 19, fontWeight: "700" },
  sub: { color: C.muted, fontSize: 11, marginTop: 2 },
  content: { padding: 16, paddingBottom: 40 },
  search: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 11, paddingHorizontal: 12, marginBottom: 14 },
  searchInput: { flex: 1, color: C.text, fontSize: 13, paddingVertical: 11 },
  error: { color: C.error, fontSize: 12, marginBottom: 12 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12, marginBottom: 10 },
  cardPressed: { backgroundColor: C.raised },
  cover: { width: 58, height: 58, borderRadius: 12, backgroundColor: C.raised, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  coverImage: { width: "100%", height: "100%" },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: "700" },
  owner: { color: C.accent, fontSize: 10, marginTop: 2 },
  desc: { color: C.muted, fontSize: 11, marginTop: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 },
  meta: { color: C.muted, fontSize: 10 },
  dot: { color: C.muted, fontSize: 10 },
  empty: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyTitle: { color: C.text, fontSize: 15, fontWeight: "700" },
  emptySub: { color: C.muted, fontSize: 12, textAlign: "center", paddingHorizontal: 40, lineHeight: 18 },
});
