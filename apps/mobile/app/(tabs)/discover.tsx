import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Image, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";

const C = { bg: "#0B0C0F", card: "#14161B", raised: "#1C1F26", text: "#F7F7F5", muted: "#9296A1", accent: "#D7B879", border: "#292C33" };
const API = "http://192.168.100.9:3000";

interface Wallpaper { id: string; title: string; imageUrl: string; thumbnailUrl: string | null; likes: number; downloads: number; likedByMe: boolean; }

export default function DiscoverScreen() {
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("All");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(`${API}/api/v1/wallpapers`).then((r) => r.json()).then((d) => {
      setWallpapers(d.wallpapers ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = wallpapers.filter((w) => w.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Discover</Text>
            <Text style={styles.subtitle}>Curated visuals for every screen</Text>
          </View>
          <Pressable style={styles.filterBtn}>
            <Ionicons name="options-outline" size={20} color={C.text} />
          </Pressable>
        </View>

        <View style={styles.search}>
          <Ionicons name="search-outline" size={18} color={C.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search wallpapers, creators, tags…"
            placeholderTextColor={C.muted}
            style={styles.searchInput}
          />
        </View>

        {loading ? (
          <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="images-outline" size={48} color={C.muted} />
            <Text style={styles.emptyText}>No wallpapers yet</Text>
            <Text style={styles.emptySub}>Seed data from the web app to see content here.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filtered.map((w) => (
              <Pressable key={w.id} style={styles.card}>
                <Image source={{ uri: w.thumbnailUrl || w.imageUrl }} style={styles.cardImage} />
                <View style={styles.cardFooter}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{w.title}</Text>
                  <View style={styles.cardMeta}>
                    <View style={styles.cardActions}>
                      <Ionicons name={w.likedByMe ? "heart" : "heart-outline"} size={13} color={w.likedByMe ? C.accent : C.muted} />
                      <Text style={styles.cardStat}>{w.likes}</Text>
                      <Ionicons name="download-outline" size={13} color={C.muted} />
                      <Text style={styles.cardStat}>{w.downloads}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  title: { fontSize: 26, fontWeight: "700", color: C.text },
  subtitle: { fontSize: 13, color: C.muted, marginTop: 2 },
  filterBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  search: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  searchInput: { flex: 1, color: C.text, fontSize: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "47%", backgroundColor: C.card, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  cardImage: { width: "100%", height: 150, backgroundColor: C.raised },
  cardFooter: { padding: 10 },
  cardTitle: { fontSize: 13, fontWeight: "600", color: C.text },
  cardMeta: { marginTop: 4 },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardStat: { fontSize: 11, color: C.muted, marginRight: 6 },
  empty: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyText: { color: C.text, fontSize: 16, fontWeight: "600" },
  emptySub: { color: C.muted, fontSize: 13, textAlign: "center" },
});
