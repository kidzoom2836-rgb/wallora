import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, apiJson } from "../lib/api";

const C = { bg: "#0B0C0F", card: "#14161B", raised: "#1C1F26", text: "#F7F7F5", muted: "#9296A1", accent: "#D7B879", border: "#292C33", error: "#E46F75" };

interface Project {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  assetCount: number;
  noteCount: number;
  createdAt: string;
}

export default function ProjectsScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiJson<Project[]>("/api/v1/projects");
      setProjects(data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Could not load projects.");
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const create = async () => {
    if (name.trim().length < 2 || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await apiFetch("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Could not create project.");
      setName("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Could not create project.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={21} color={C.text} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Projects</Text>
          <Text style={styles.sub}>Organize your creative work</Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.accent} />}
      >
        <View style={styles.createCard}>
          <Text style={styles.label}>NEW PROJECT</Text>
          <View style={styles.createRow}>
            <TextInput value={name} onChangeText={setName} placeholder="Project name…" placeholderTextColor={C.muted} style={styles.createInput} onSubmitEditing={create} />
            <Pressable style={[styles.createBtn, name.trim().length < 2 && styles.createDisabled]} onPress={create} disabled={creating || name.trim().length < 2}>
              {creating ? <ActivityIndicator color={C.bg} size="small" /> : <Ionicons name="add" size={22} color={C.bg} />}
            </Pressable>
          </View>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {loading ? (
          <ActivityIndicator color={C.accent} style={{ marginTop: 50 }} />
        ) : projects.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={46} color={C.muted} />
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptySub}>Create one above to start collecting ideas, wallpapers and generations.</Text>
          </View>
        ) : (
          projects.map((p) => (
            <View key={p.id} style={styles.card}>
              <View style={styles.cardIcon}><Ionicons name="folder-outline" size={20} color={C.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{p.name}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>{p.description ?? "No description"}</Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.metaText}>{p.assetCount} assets</Text>
                  <Text style={styles.dot}>·</Text>
                  <Text style={styles.metaText}>{p.noteCount} notes</Text>
                  <Text style={styles.dot}>·</Text>
                  <Text style={styles.metaText}>{p.isPublic ? "Public" : "Private"}</Text>
                </View>
              </View>
            </View>
          ))
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
  createCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 16 },
  label: { color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 9 },
  createRow: { flexDirection: "row", gap: 8 },
  createInput: { flex: 1, backgroundColor: C.raised, color: C.text, borderRadius: 11, paddingHorizontal: 13, fontSize: 14, borderWidth: 1, borderColor: C.border },
  createBtn: { width: 46, height: 46, borderRadius: 11, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  createDisabled: { opacity: 0.4 },
  error: { color: C.error, fontSize: 12, marginBottom: 12 },
  card: { flexDirection: "row", gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  cardIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.raised, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: C.text, fontSize: 15, fontWeight: "700" },
  cardDesc: { color: C.muted, fontSize: 12, marginTop: 3 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  metaText: { color: C.muted, fontSize: 10 },
  dot: { color: C.muted, fontSize: 10 },
  empty: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: "700" },
  emptySub: { color: C.muted, fontSize: 12, textAlign: "center", paddingHorizontal: 40, lineHeight: 18 },
});
