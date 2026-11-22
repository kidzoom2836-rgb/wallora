import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, RefreshControl, Image } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, apiJson } from "../lib/api";
import { assetUrl } from "../lib/config";
import {
  DEFAULT_META,
  STATUS_LABEL,
  type ProjectMeta,
  type ProjectStatus,
} from "../lib/projects";

const C = { bg: "#0B0C0F", card: "#14161B", raised: "#1C1F26", text: "#F7F7F5", muted: "#9296A1", accent: "#D7B879", border: "#292C33", error: "#E46F75", green: "#5FB98A" };

interface Project {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  assetCount: number;
  noteCount: number;
  shoutoutCount: number;
  meta: ProjectMeta;
  createdAt: string;
}

export default function ProjectsScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showDetails, setShowDetails] = useState(false);
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
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Could not create project.");
      setName("");
      setDescription("");
      setShowDetails(false);
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
          <Text style={styles.sub}>Real showcases for your creative work</Text>
        </View>
        <Pressable onPress={() => router.push("/projects/showcase")} style={styles.showcaseBtn}>
          <Ionicons name="compass-outline" size={18} color={C.accent} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.accent} />}
      >
        <View style={styles.createCard}>
          <View style={styles.createHeading}>
            <Text style={styles.label}>NEW PROJECT</Text>
            <Pressable onPress={() => setShowDetails((v) => !v)} hitSlop={8}>
              <Text style={styles.detailsToggle}>{showDetails ? "Less" : "Details"}</Text>
            </Pressable>
          </View>
          <View style={styles.createRow}>
            <TextInput value={name} onChangeText={setName} placeholder="Project name…" placeholderTextColor={C.muted} style={styles.createInput} onSubmitEditing={create} />
            <Pressable style={[styles.createBtn, name.trim().length < 2 && styles.createDisabled]} onPress={create} disabled={creating || name.trim().length < 2}>
              {creating ? <ActivityIndicator color={C.bg} size="small" /> : <Ionicons name="add" size={22} color={C.bg} />}
            </Pressable>
          </View>
          {showDetails && (
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What are you creating? (optional)"
              placeholderTextColor={C.muted}
              style={[styles.createInput, styles.descriptionInput]}
              multiline
              maxLength={500}
            />
          )}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {loading ? (
          <ActivityIndicator color={C.accent} style={{ marginTop: 50 }} />
        ) : projects.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={46} color={C.muted} />
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptySub}>Create one above to start collecting wallpapers, generations and ideas.</Text>
          </View>
        ) : (
          projects.map((p) => {
            const meta = p.meta ?? DEFAULT_META;
            const cover = assetUrl(p.coverUrl);
            return (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/project/${p.id}`)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <View style={styles.thumb}>
                  {cover ? (
                    <Image source={{ uri: cover }} style={styles.thumbImage} resizeMode="cover" />
                  ) : (
                    <Ionicons name="folder-outline" size={22} color={C.accent} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{p.name}</Text>
                    {p.isPublic && <Ionicons name="globe-outline" size={13} color={C.green} />}
                  </View>
                  <Text style={styles.cardDesc} numberOfLines={2}>{p.description ?? "No description yet"}</Text>
                  <View style={styles.cardMeta}>
                    <Text style={[styles.metaText, styles.status]}>{STATUS_LABEL[meta.status as ProjectStatus] ?? "Planning"}</Text>
                    <Text style={styles.dot}>·</Text>
                    <Text style={styles.metaText}>{meta.progress ?? 0}%</Text>
                    <Text style={styles.dot}>·</Text>
                    <Text style={styles.metaText}>{p.assetCount} assets</Text>
                    <Text style={styles.dot}>·</Text>
                    <Text style={styles.metaText}>{p.noteCount} notes</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, meta.progress ?? 0))}%` }]} />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={17} color={C.muted} />
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
  showcaseBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  title: { color: C.text, fontSize: 20, fontWeight: "700" },
  sub: { color: C.muted, fontSize: 12, marginTop: 2 },
  content: { padding: 16, paddingBottom: 40 },
  createCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 16 },
  createHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 },
  label: { color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  detailsToggle: { color: C.accent, fontSize: 12, fontWeight: "600" },
  createRow: { flexDirection: "row", gap: 8 },
  createInput: { flex: 1, backgroundColor: C.raised, color: C.text, borderRadius: 11, paddingHorizontal: 13, fontSize: 14, borderWidth: 1, borderColor: C.border },
  descriptionInput: { marginTop: 8, minHeight: 64, textAlignVertical: "top", paddingTop: 12 },
  createBtn: { width: 46, height: 46, borderRadius: 11, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  createDisabled: { opacity: 0.4 },
  error: { color: C.error, fontSize: 12, marginBottom: 12 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  cardPressed: { backgroundColor: C.raised },
  thumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: C.raised, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImage: { width: "100%", height: "100%" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { color: C.text, fontSize: 15, fontWeight: "700", flexShrink: 1 },
  cardDesc: { color: C.muted, fontSize: 12, marginTop: 3 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, flexWrap: "wrap" },
  metaText: { color: C.muted, fontSize: 10 },
  status: { color: C.accent },
  dot: { color: C.muted, fontSize: 10 },
  progressTrack: { height: 3, borderRadius: 3, backgroundColor: C.raised, marginTop: 9, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: C.accent },
  empty: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: "700" },
  emptySub: { color: C.muted, fontSize: 12, textAlign: "center", paddingHorizontal: 40, lineHeight: 18 },
});
