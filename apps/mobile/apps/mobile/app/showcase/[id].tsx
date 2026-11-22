import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Share } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { apiJson } from "../../lib/api";
import { API_BASE, assetUrl } from "../../lib/config";
import { STATUS_LABEL, assetImage, coverImage, type PublicProject } from "../../lib/projects";

const C = {
  bg: "#0B0C0F",
  card: "#14161B",
  raised: "#1C1F26",
  text: "#F7F7F5",
  muted: "#9296A1",
  accent: "#D7B879",
  border: "#292C33",
  green: "#5FB98A",
  blue: "#5B9EEA",
};

const TIER_COLOR: Record<string, string> = { free: C.muted, verified: C.blue, premium: C.accent };

export default function PublicShowcaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<PublicProject | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const notice = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [data, me] = await Promise.all([
        apiJson<PublicProject>(`/api/v1/projects/showcase/${id}`),
        apiJson<{ id: string }>("/api/v1/auth/me").catch(() => null),
      ]);
      setProject(data);
      setCurrentUserId(me?.id ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Could not load this showcase.");
    }
  }, [id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const toggleShoutout = async () => {
    if (!project || busy) return;
    setBusy(true);
    try {
      const data = await apiJson<{ active: boolean; count: number }>(
        `/api/v1/projects/${project.id}/shoutouts`,
        { method: "POST" },
      );
      notice(data.active ? "Shoutout sent!" : "Shoutout removed.");
      await load();
    } catch (e: any) {
      notice(e?.status === 401 ? "Sign in to give a shoutout." : e?.message ?? "Could not update shoutout.");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!project) return;
    const url = `${API_BASE}/projects/${project.id}`;
    try {
      await Share.share({ message: `${project.name} on WALLORA\n${url}`, url });
    } catch {
      // User cancelled the share sheet.
    }
  };

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: C.bg }]}><ActivityIndicator color={C.accent} size="large" /></View>;
  }
  if (!project) {
    return (
      <View style={[styles.centered, { backgroundColor: C.bg }]}>
        <Ionicons name="alert-circle-outline" size={42} color={C.muted} />
        <Text style={styles.stateText}>{error ?? "Showcase not found."}</Text>
        <Pressable onPress={() => router.back()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Go back</Text></Pressable>
      </View>
    );
  }

  const meta = project.meta ?? { status: "planning" as const, progress: 0, targetDate: null, milestones: [] };
  const hero = assetUrl(coverImage(project));
  const owner = project.owner;
  const ownerName = owner?.displayName || owner?.username || "WALLORA creator";
  const tierColor = TIER_COLOR[owner?.tier ?? "free"] ?? C.muted;
  const hasShouted = (project.shoutouts ?? []).some((s) => s.userId === currentUserId);
  const doneCount = meta.milestones.filter((m) => m.done).length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={21} color={C.text} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>Public showcase</Text>
          <Text style={styles.sub}>Community project</Text>
        </View>
        <Pressable onPress={share} style={styles.iconBtn}><Ionicons name="share-social-outline" size={18} color={C.accent} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          {hero ? <Image source={{ uri: hero }} style={styles.heroImage} resizeMode="cover" /> : <View style={[styles.heroImage, styles.heroFallback]}><Ionicons name="layers-outline" size={38} color={C.accent} /></View>}
        </View>

        <View style={styles.section}>
          <Text style={styles.projectName}>{project.name}</Text>
          {!!project.description && <Text style={styles.description}>{project.description}</Text>}
          <View style={styles.ownerRow}>
            <View style={styles.avatar}>
              {owner?.avatarUrl ? <Image source={{ uri: assetUrl(owner.avatarUrl) }} style={styles.avatarImage} /> : <Ionicons name="person-outline" size={17} color={C.muted} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ownerName}>{ownerName}</Text>
              <Text style={styles.ownerTier}>{owner?.tier === "premium" ? "Premium creator" : owner?.tier === "verified" ? "Verified creator" : "Free verified creator"}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={19} color={tierColor} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Progress</Text>
            <Text style={styles.sectionCount}>{STATUS_LABEL[meta.status] ?? "Planning"}</Text>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, meta.progress ?? 0))}%` }]} /></View>
          <Text style={styles.progressValue}>{meta.progress ?? 0}% complete · {doneCount}/{meta.milestones.length} milestones</Text>
          {meta.milestones.map((milestone) => (
            <View key={milestone.id} style={styles.milestoneRow}>
              <Ionicons name={milestone.done ? "checkmark-circle" : "ellipse-outline"} size={17} color={milestone.done ? C.green : C.muted} />
              <Text style={[styles.milestoneText, milestone.done && styles.milestoneTextDone]}>{milestone.title}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Showcase assets</Text>
            <Text style={styles.sectionCount}>{project.assets?.length ?? 0}</Text>
          </View>
          {(project.assets ?? []).length === 0 ? (
            <Text style={styles.emptyText}>No assets in this showcase yet.</Text>
          ) : (
            <View style={styles.assetGrid}>
              {project.assets.map((asset) => {
                const image = assetUrl(assetImage(asset));
                const label = asset.assetType === "generation" ? asset.generation?.prompt ?? "AI generation" : asset.wallpaper?.title ?? "Wallpaper";
                return (
                  <View key={asset.id} style={styles.assetCard}>
                    {image ? <Image source={{ uri: image }} style={styles.assetImage} resizeMode="cover" /> : <View style={[styles.assetImage, styles.assetFallback]}><Ionicons name="image-outline" size={21} color={C.muted} /></View>}
                    <Text style={styles.assetLabel} numberOfLines={2}>{label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {(project.notes ?? []).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Creator notes</Text>
            {project.notes.map((note) => (
              <View key={note.id} style={styles.noteRow}>
                <Ionicons name="document-text-outline" size={15} color={C.accent} />
                <Text style={styles.noteText}>{note.content}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Pressable onPress={toggleShoutout} disabled={busy} style={[styles.shoutButton, hasShouted && styles.shoutButtonActive]}>
            {busy ? <ActivityIndicator color={C.text} size="small" /> : <Ionicons name={hasShouted ? "star" : "star-outline"} size={17} color={C.text} />}
            <Text style={styles.shoutButtonText}>{hasShouted ? "Shoutout sent" : "Give a shoutout"}</Text>
          </Pressable>
          <Text style={styles.shoutCount}>{project.shoutouts?.length ?? 0} community shoutouts</Text>
          {(project.shoutouts ?? []).slice(0, 6).map((shout, index) => (
            <Text key={`${shout.userId}-${index}`} style={styles.shoutName}>
              {shout.displayName || shout.username || "WALLORA creator"}
            </Text>
          ))}
        </View>

        {currentUserId === owner?.id && (
          <Pressable onPress={() => router.push(`/project/${project.id}`)} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Open project editor</Text>
          </Pressable>
        )}
      </ScrollView>

      {toast && <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  stateText: { color: C.muted, fontSize: 13, textAlign: "center", paddingHorizontal: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 50, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { padding: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  title: { color: C.text, fontSize: 18, fontWeight: "700" },
  sub: { color: C.muted, fontSize: 11, marginTop: 2 },
  content: { padding: 16, paddingBottom: 50 },
  hero: { borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  heroImage: { width: "100%", height: 190, backgroundColor: C.raised },
  heroFallback: { alignItems: "center", justifyContent: "center" },
  section: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 14 },
  projectName: { color: C.text, fontSize: 20, fontWeight: "800" },
  description: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 8 },
  ownerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.raised, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%" },
  ownerName: { color: C.text, fontSize: 13, fontWeight: "700" },
  ownerTier: { color: C.muted, fontSize: 10, marginTop: 2 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { color: C.text, fontSize: 14, fontWeight: "700" },
  sectionCount: { color: C.muted, fontSize: 11 },
  progressTrack: { height: 7, borderRadius: 7, backgroundColor: C.raised, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: C.accent },
  progressValue: { color: C.muted, fontSize: 11, marginTop: 7 },
  milestoneRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 7 },
  milestoneText: { color: C.text, fontSize: 12, flex: 1 },
  milestoneTextDone: { color: C.muted, textDecorationLine: "line-through" },
  assetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  assetCard: { width: "47%", backgroundColor: C.raised, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  assetImage: { width: "100%", height: 100 },
  assetFallback: { alignItems: "center", justifyContent: "center" },
  assetLabel: { color: C.text, fontSize: 11, padding: 8 },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, paddingVertical: 8 },
  noteText: { color: C.text, fontSize: 12, lineHeight: 18, flex: 1 },
  shoutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 12 },
  shoutButtonActive: { borderColor: C.accent, backgroundColor: "rgba(215,184,121,0.12)" },
  shoutButtonText: { color: C.text, fontSize: 13, fontWeight: "700" },
  shoutCount: { color: C.muted, fontSize: 11, marginTop: 10, textAlign: "center" },
  shoutName: { color: C.text, fontSize: 11, marginTop: 6, textAlign: "center" },
  emptyText: { color: C.muted, fontSize: 12, lineHeight: 18, paddingVertical: 8 },
  secondaryButton: { borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  secondaryButtonText: { color: C.text, fontSize: 13, fontWeight: "600" },
  toast: { position: "absolute", left: 16, right: 16, bottom: 24, backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, alignItems: "center" },
  toastText: { color: C.text, fontSize: 12, textAlign: "center" },
});
