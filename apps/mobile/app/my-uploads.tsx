import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiJson } from "../lib/api";
import { assetUrl } from "../lib/config";

const C = { bg: "#0B0C0F", card: "#14161B", raised: "#1C1F26", text: "#F7F7F5", muted: "#9296A1", accent: "#D7B879", border: "#292C33" };

interface Upload {
  id: string;
  slug: string;
  title: string;
  status: string;
  orientation: string;
  dominantColor: string | null;
  likeCount: number;
  downloadCount: number;
  createdAt: string;
  assets: { variant: string; objectKey: string }[];
}

const STATUS_COLOR: Record<string, string> = {
  approved: "#5FB98A",
  pending: "#D7B879",
  rejected: "#E46F75",
  flagged: "#E46F75",
};

export default function MyUploadsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiJson<{ items: Upload[] }>("/api/v1/users/me/wallpapers?limit=24")
      .then((d) => setItems(d.items ?? []))
      .catch((e) => setError(e?.message ?? "Could not load uploads."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={21} color={C.text} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>My Uploads</Text>
          <Text style={styles.sub}>Your submitted wallpapers</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.info}>
          <Ionicons name="information-circle-outline" size={17} color={C.accent} />
          <Text style={styles.infoText}>Upload and publish new wallpapers on the WALLORA web app. Approved uploads appear in Discover for everyone.</Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {loading ? (
          <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="cloud-upload-outline" size={46} color={C.muted} />
            <Text style={styles.emptyTitle}>No uploads yet</Text>
            <Text style={styles.emptySub}>Your uploaded wallpapers and their moderation status will show up here.</Text>
          </View>
        ) : (
          items.map((u) => {
            const ref = u.assets?.find((a) => a.variant === "grid")?.objectKey ?? u.assets?.[0]?.objectKey;
            return (
              <View key={u.id} style={styles.card}>
                <View style={styles.thumb}>
                  {assetUrl(ref) ? (
                    <Image source={{ uri: assetUrl(ref) }} style={styles.thumbImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.thumbImage, { backgroundColor: u.dominantColor ?? C.raised }]} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{u.title}</Text>
                    <View style={[styles.status, { borderColor: STATUS_COLOR[u.status] ?? C.muted }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLOR[u.status] ?? C.muted }]}>{u.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardMeta}>{u.likeCount} likes · {u.downloadCount} downloads</Text>
                  <Text style={styles.cardDate}>{new Date(u.createdAt).toLocaleDateString()}</Text>
                </View>
              </View>
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
  title: { color: C.text, fontSize: 20, fontWeight: "700" },
  sub: { color: C.muted, fontSize: 12, marginTop: 2 },
  content: { padding: 16, paddingBottom: 40 },
  info: { flexDirection: "row", gap: 9, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, marginBottom: 16 },
  infoText: { color: C.muted, fontSize: 12, lineHeight: 18, flex: 1 },
  error: { color: "#E46F75", fontSize: 12, marginBottom: 10 },
  card: { flexDirection: "row", gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  thumb: { width: 86, height: 76, borderRadius: 10, overflow: "hidden", backgroundColor: C.raised },
  thumbImage: { width: "100%", height: "100%" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: "700", flex: 1 },
  status: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  statusText: { fontSize: 8, fontWeight: "800" },
  cardMeta: { color: C.muted, fontSize: 11, marginTop: 6 },
  cardDate: { color: C.muted, fontSize: 10, marginTop: 3 },
  empty: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: "700" },
  emptySub: { color: C.muted, fontSize: 12, textAlign: "center", paddingHorizontal: 40, lineHeight: 18 },
});
