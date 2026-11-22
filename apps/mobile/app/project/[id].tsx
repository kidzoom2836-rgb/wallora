import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Image, Share, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, apiJson } from "../../lib/api";
import { API_BASE, assetUrl } from "../../lib/config";
import {
  DEFAULT_META,
  STATUS_LABEL,
  assetImage,
  coverImage,
  newId,
  type CatalogGeneration,
  type CatalogWallpaper,
  type ProjectDetail,
  type ProjectMeta,
  type ProjectStatus,
} from "../../lib/projects";

const C = {
  bg: "#0B0C0F",
  card: "#14161B",
  raised: "#1C1F26",
  text: "#F7F7F5",
  muted: "#9296A1",
  accent: "#D7B879",
  border: "#292C33",
  error: "#E46F75",
  green: "#5FB98A",
};
const STATUSES: ProjectStatus[] = ["planning", "in_progress", "completed", "archived"];

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCover, setEditCover] = useState("");
  const [editPublic, setEditPublic] = useState(false);

  const [progressDraft, setProgressDraft] = useState("0");
  const [targetDate, setTargetDate] = useState("");
  const [milestoneInput, setMilestoneInput] = useState("");
  const [noteInput, setNoteInput] = useState("");

  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogTab, setCatalogTab] = useState<"wallpaper" | "generation">("wallpaper");
  const [wallpapers, setWallpapers] = useState<CatalogWallpaper[]>([]);
  const [generations, setGenerations] = useState<CatalogGeneration[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const notice = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  };

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const data = await apiJson<ProjectDetail>(`/api/v1/projects/${id}`);
      setDetail(data);
      setEditName(data.name);
      setEditDescription(data.description ?? "");
      setEditCover(data.coverUrl ?? "");
      setEditPublic(data.isPublic);
      setProgressDraft(String(data.meta?.progress ?? 0));
      setTargetDate(data.meta?.targetDate ?? "");
    } catch (e: any) {
      setError(e?.message ?? "Could not load this project.");
    }
  }, [id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const patchMeta = async (patch: Partial<ProjectMeta>) => {
    if (!detail || busy) return;
    setBusy(true);
    try {
      const data = await apiJson<ProjectMeta>(`/api/v1/projects/${detail.id}/meta`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setDetail({ ...detail, meta: data });
    } catch (e: any) {
      notice(e?.message ?? "Could not update progress.");
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = async () => {
    if (!detail || editName.trim().length < 2 || busy) return;
    setBusy(true);
    try {
      const data = await apiJson<Partial<ProjectDetail>>(`/api/v1/projects/${detail.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
          coverUrl: editCover.trim() || null,
          isPublic: editPublic,
        }),
      });
      setDetail({ ...detail, ...data });
      setEditing(false);
      notice("Project details saved.");
    } catch (e: any) {
      notice(e?.message ?? "Could not save project.");
    } finally {
      setBusy(false);
    }
  };

  const commitProgress = async () => {
    if (!detail) return;
    const value = Math.max(0, Math.min(100, Number(progressDraft) || 0));
    setProgressDraft(String(value));
    await patchMeta({ progress: value });
  };

  const addMilestone = async () => {
    if (!detail || milestoneInput.trim().length < 1) return;
    const title = milestoneInput.trim();
    const milestones = [...(detail.meta?.milestones ?? []), { id: newId(), title, done: false, completedAt: null }];
    setMilestoneInput("");
    await patchMeta({ milestones });
  };

  const toggleMilestone = async (index: number) => {
    if (!detail) return;
    const milestones = [...(detail.meta?.milestones ?? [])];
    const current = milestones[index];
    if (!current) return;
    milestones[index] = {
      ...current,
      done: !current.done,
      completedAt: current.done ? null : new Date().toISOString(),
    };
    await patchMeta({ milestones });
  };

  const removeMilestone = async (index: number) => {
    if (!detail) return;
    const milestones = (detail.meta?.milestones ?? []).filter((_, i) => i !== index);
    await patchMeta({ milestones });
  };

  const addNote = async () => {
    if (!detail || noteInput.trim().length < 1 || busy) return;
    setBusy(true);
    try {
      const data = await apiJson<{ id: string; content: string; createdAt: string }>(
        `/api/v1/projects/${detail.id}/notes`,
        { method: "POST", body: JSON.stringify({ content: noteInput.trim() }) },
      );
      setDetail({ ...detail, notes: [data, ...(detail.notes ?? [])] });
      setNoteInput("");
      notice("Note added.");
    } catch (e: any) {
      notice(e?.message ?? "Could not add note.");
    } finally {
      setBusy(false);
    }
  };

  const removeNote = async (noteId: string) => {
    if (!detail) return;
    try {
      await apiFetch(`/api/v1/projects/${detail.id}/notes?noteId=${encodeURIComponent(noteId)}`, { method: "DELETE" });
      setDetail({ ...detail, notes: (detail.notes ?? []).filter((n) => n.id !== noteId) });
    } catch (e: any) {
      notice(e?.message ?? "Could not remove note.");
    }
  };

  const openCatalog = async () => {
    setCatalogOpen(true);
    if (wallpapers.length || generations.length || catalogLoading) return;
    setCatalogLoading(true);
    try {
      const [wallpaperData, generationData] = await Promise.all([
        apiJson<{ items: CatalogWallpaper[] }>("/api/v1/users/me/wallpapers?limit=24").catch(() => ({ items: [] })),
        apiJson<{ items: CatalogGeneration[] }>("/api/v1/ai/generations?limit=24").catch(() => ({ items: [] })),
      ]);
      setWallpapers(wallpaperData.items ?? []);
      setGenerations(generationData.items ?? []);
    } finally {
      setCatalogLoading(false);
    }
  };

  const addAsset = async (payload: { assetType: "wallpaper" | "generation"; wallpaperId?: string; generationId?: string }) => {
    if (!detail || busy) return;
    setBusy(true);
    try {
      await apiJson(`/api/v1/projects/${detail.id}/assets`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCatalogOpen(false);
      await load();
      notice("Asset added to project.");
    } catch (e: any) {
      notice(e?.message ?? "Could not add asset.");
    } finally {
      setBusy(false);
    }
  };

  const removeAsset = async (assetId: string) => {
    if (!detail) return;
    try {
      await apiFetch(`/api/v1/projects/${detail.id}/assets?assetId=${encodeURIComponent(assetId)}`, { method: "DELETE" });
      setDetail({ ...detail, assets: (detail.assets ?? []).filter((a) => a.id !== assetId) });
    } catch (e: any) {
      notice(e?.message ?? "Could not remove asset.");
    }
  };

  const shareProject = async () => {
    if (!detail) return;
    try {
      if (!detail.isPublic) {
        const data = await apiJson<Partial<ProjectDetail>>(`/api/v1/projects/${detail.id}`, {
          method: "PATCH",
          body: JSON.stringify({ isPublic: true }),
        });
        setDetail({ ...detail, ...data });
        setEditPublic(true);
      }
      const url = `${API_BASE}/projects/${detail.id}`;
      await Share.share({ message: `${detail.name} on WALLORA\n${url}`, url });
    } catch (e: any) {
      notice(e?.message ?? "Could not share project.");
    }
  };

  const deleteProject = async () => {
    if (!detail || busy) return;
    setBusy(true);
    try {
      await apiFetch(`/api/v1/projects/${detail.id}`, { method: "DELETE" });
      router.replace("/projects");
    } catch (e: any) {
      notice(e?.message ?? "Could not delete project.");
      setBusy(false);
    }
  };

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: C.bg }]}><ActivityIndicator color={C.accent} size="large" /></View>;
  }
  if (!detail) {
    return (
      <View style={[styles.centered, { backgroundColor: C.bg }]}>
        <Ionicons name="alert-circle-outline" size={42} color={C.muted} />
        <Text style={styles.stateText}>{error ?? "Project not found."}</Text>
        <Pressable onPress={() => router.back()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Go back</Text></Pressable>
      </View>
    );
  }

  const meta = detail.meta ?? DEFAULT_META;
  const heroImage = assetUrl(coverImage(detail));
  const doneCount = meta.milestones.filter((m) => m.done).length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={21} color={C.text} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{detail.name}</Text>
          <Text style={styles.sub}>{STATUS_LABEL[meta.status] ?? "Planning"} · {detail.assets?.length ?? 0} assets</Text>
        </View>
        <Pressable onPress={() => setEditing((v) => !v)} style={styles.iconBtn}><Ionicons name={editing ? "close" : "create-outline"} size={19} color={C.accent} /></Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.accent} />}
      >
        <View style={styles.hero}>
          {heroImage ? (
            <Image source={{ uri: heroImage }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImage, styles.heroFallback]}><Ionicons name="folder-open-outline" size={38} color={C.accent} /></View>
          )}
        </View>

        {editing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Project details</Text>
            <TextInput value={editName} onChangeText={setEditName} style={styles.input} placeholder="Project name" placeholderTextColor={C.muted} />
            <TextInput value={editDescription} onChangeText={setEditDescription} style={[styles.input, styles.textArea]} placeholder="Description" placeholderTextColor={C.muted} multiline maxLength={500} />
            <TextInput value={editCover} onChangeText={setEditCover} style={styles.input} placeholder="Cover image URL (optional)" placeholderTextColor={C.muted} autoCapitalize="none" />
            <Pressable onPress={() => setEditPublic((v) => !v)} style={styles.toggleRow}>
              <Ionicons name={editPublic ? "globe-outline" : "lock-closed-outline"} size={17} color={editPublic ? C.green : C.muted} />
              <Text style={styles.toggleText}>{editPublic ? "Public showcase" : "Private project"}</Text>
              <View style={[styles.switch, editPublic && styles.switchOn]}><View style={[styles.switchKnob, editPublic && styles.switchKnobOn]} /></View>
            </Pressable>
            <Pressable onPress={saveDetails} disabled={busy || editName.trim().length < 2} style={styles.primaryButton}>
              {busy ? <ActivityIndicator color={C.bg} size="small" /> : <Text style={styles.primaryButtonText}>Save details</Text>}
            </Pressable>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Progress</Text>
            <Text style={styles.sectionCount}>{doneCount}/{meta.milestones.length} milestones</Text>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${meta.progress}%` }]} /></View>
          <Text style={styles.progressValue}>{meta.progress}% complete</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
            {STATUSES.map((status) => (
              <Pressable
                key={status}
                onPress={() => void patchMeta({ status })}
                style={[styles.statusChip, meta.status === status && styles.statusChipActive]}
              >
                <Text style={[styles.statusChipText, meta.status === status && styles.statusChipTextActive]}>{STATUS_LABEL[status]}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.row}>
            <TextInput value={progressDraft} onChangeText={setProgressDraft} keyboardType="numeric" style={[styles.input, styles.progressInput]} placeholder="0–100" placeholderTextColor={C.muted} onSubmitEditing={commitProgress} />
            <Pressable onPress={commitProgress} style={styles.smallButton}><Text style={styles.smallButtonText}>Set</Text></Pressable>
          </View>
          <View style={styles.row}>
            <TextInput
              value={targetDate}
              onChangeText={setTargetDate}
              onEndEditing={() => void patchMeta({ targetDate: targetDate.trim() || null })}
              style={[styles.input, { flex: 1 }]}
              placeholder="Target date YYYY-MM-DD"
              placeholderTextColor={C.muted}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Milestones</Text>
            <Text style={styles.sectionCount}>{doneCount} done</Text>
          </View>
          {meta.milestones.map((milestone, index) => (
            <View key={milestone.id} style={styles.milestoneRow}>
              <Pressable onPress={() => void toggleMilestone(index)} hitSlop={6}>
                <Ionicons name={milestone.done ? "checkmark-circle" : "ellipse-outline"} size={20} color={milestone.done ? C.green : C.muted} />
              </Pressable>
              <Text style={[styles.milestoneText, milestone.done && styles.milestoneTextDone]}>{milestone.title}</Text>
              <Pressable onPress={() => void removeMilestone(index)} hitSlop={6}><Ionicons name="trash-outline" size={16} color={C.muted} /></Pressable>
            </View>
          ))}
          <View style={styles.row}>
            <TextInput value={milestoneInput} onChangeText={setMilestoneInput} style={[styles.input, { flex: 1 }]} placeholder="Add a milestone" placeholderTextColor={C.muted} onSubmitEditing={addMilestone} />
            <Pressable onPress={addMilestone} style={styles.smallButton}><Ionicons name="add" size={18} color={C.bg} /></Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Assets</Text>
            <Pressable onPress={openCatalog} style={styles.linkButton}><Text style={styles.linkButtonText}>Add asset</Text></Pressable>
          </View>
          {(detail.assets ?? []).length === 0 ? (
            <Text style={styles.emptyText}>Add wallpapers or AI generations to build your showcase.</Text>
          ) : (
            <View style={styles.assetGrid}>
              {detail.assets.map((asset) => {
                const image = assetUrl(assetImage(asset));
                const label = asset.assetType === "generation"
                  ? asset.generation?.prompt ?? "AI generation"
                  : asset.wallpaper?.title ?? "Wallpaper";
                return (
                  <View key={asset.id} style={styles.assetCard}>
                    {image ? (
                      <Image source={{ uri: image }} style={styles.assetImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.assetImage, styles.assetFallback]}><Ionicons name="image-outline" size={22} color={C.muted} /></View>
                    )}
                    <Pressable onPress={() => void removeAsset(asset.id)} style={styles.assetRemove} hitSlop={6}>
                      <Ionicons name="close-circle" size={18} color={C.text} />
                    </Pressable>
                    <Text style={styles.assetLabel} numberOfLines={2}>{label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {catalogOpen && (
          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Choose an asset</Text>
              <Pressable onPress={() => setCatalogOpen(false)}><Ionicons name="close" size={19} color={C.muted} /></Pressable>
            </View>
            <View style={styles.catalogTabs}>
              {(["wallpaper", "generation"] as const).map((tab) => (
                <Pressable key={tab} onPress={() => setCatalogTab(tab)} style={[styles.catalogTab, catalogTab === tab && styles.catalogTabActive]}>
                  <Text style={[styles.catalogTabText, catalogTab === tab && styles.catalogTabTextActive]}>{tab === "wallpaper" ? "Wallpapers" : "AI generations"}</Text>
                </Pressable>
              ))}
            </View>
            {catalogLoading ? (
              <ActivityIndicator color={C.accent} style={{ marginTop: 18 }} />
            ) : catalogTab === "wallpaper" ? (
              wallpapers.length === 0 ? <Text style={styles.emptyText}>No wallpapers yet. Upload one from the web app first.</Text> : (
                wallpapers.map((w) => {
                  const ref = w.gridAsset?.objectKey ?? w.assets?.find((a) => a.variant === "grid")?.objectKey ?? w.assets?.[0]?.objectKey;
                  const image = assetUrl(ref);
                  return (
                    <Pressable key={w.id} onPress={() => void addAsset({ assetType: "wallpaper", wallpaperId: w.id })} style={styles.catalogRow}>
                      <View style={styles.catalogThumb}>
                        {image ? <Image source={{ uri: image }} style={styles.catalogThumbImage} resizeMode="cover" /> : <Ionicons name="image-outline" size={17} color={C.muted} />}
                      </View>
                      <Text style={styles.catalogLabel} numberOfLines={1}>{w.title}</Text>
                      <Ionicons name="add-circle-outline" size={19} color={C.accent} />
                    </Pressable>
                  );
                })
              )
            ) : (
              generations.length === 0 ? <Text style={styles.emptyText}>No finished generations yet.</Text> : (
                generations.map((g) => (
                  <Pressable
                    key={g.id}
                    disabled={g.status !== "completed"}
                    onPress={() => void addAsset({ assetType: "generation", generationId: g.id })}
                    style={[styles.catalogRow, g.status !== "completed" && styles.catalogRowDisabled]}
                  >
                    <View style={styles.catalogThumb}>
                      {g.publicUrl ? <Image source={{ uri: assetUrl(g.publicUrl) }} style={styles.catalogThumbImage} resizeMode="cover" /> : <Ionicons name="sparkles-outline" size={17} color={C.muted} />}
                    </View>
                    <Text style={styles.catalogLabel} numberOfLines={1}>{g.prompt}</Text>
                    <Ionicons name="add-circle-outline" size={19} color={C.accent} />
                  </Pressable>
                ))
              )
            )}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.sectionCount}>{detail.notes?.length ?? 0}</Text>
          </View>
          {(detail.notes ?? []).map((note) => (
            <View key={note.id} style={styles.noteRow}>
              <Text style={styles.noteText}>{note.content}</Text>
              <Pressable onPress={() => void removeNote(note.id)} hitSlop={6}><Ionicons name="trash-outline" size={15} color={C.muted} /></Pressable>
            </View>
          ))}
          <View style={styles.row}>
            <TextInput value={noteInput} onChangeText={setNoteInput} style={[styles.input, { flex: 1 }]} placeholder="Add a note to your project" placeholderTextColor={C.muted} onSubmitEditing={addNote} maxLength={500} />
            <Pressable onPress={addNote} style={styles.smallButton}><Ionicons name="add" size={18} color={C.bg} /></Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Pressable onPress={shareProject} style={styles.primaryButton}>
            <Ionicons name="share-social-outline" size={17} color={C.bg} />
            <Text style={styles.primaryButtonText}>{detail.isPublic ? "Share showcase" : "Make public & share"}</Text>
          </Pressable>
          {detail.isPublic && (
            <Pressable onPress={() => router.push(`/showcase/${detail.id}`)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>View public showcase</Text>
            </Pressable>
          )}
          <Pressable onPress={deleteProject} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={16} color={C.error} />
            <Text style={styles.deleteButtonText}>Delete project</Text>
          </Pressable>
        </View>
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
  hero: { borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  heroImage: { width: "100%", height: 180, backgroundColor: C.raised },
  heroFallback: { alignItems: "center", justifyContent: "center" },
  section: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 14 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { color: C.text, fontSize: 14, fontWeight: "700" },
  sectionCount: { color: C.muted, fontSize: 11 },
  input: { backgroundColor: C.raised, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: C.text, fontSize: 13, marginBottom: 8 },
  textArea: { minHeight: 70, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 8 },
  toggleText: { color: C.text, fontSize: 13, flex: 1 },
  switch: { width: 38, height: 22, borderRadius: 11, backgroundColor: C.raised, padding: 2 },
  switchOn: { backgroundColor: C.green },
  switchKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.muted },
  switchKnobOn: { backgroundColor: C.bg, marginLeft: 16 },
  primaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: C.accent, borderRadius: 10, paddingVertical: 12, marginTop: 4 },
  primaryButtonText: { color: C.bg, fontSize: 13, fontWeight: "700" },
  secondaryButton: { borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingVertical: 11, alignItems: "center", marginTop: 8 },
  secondaryButtonText: { color: C.text, fontSize: 13, fontWeight: "600" },
  deleteButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, marginTop: 8 },
  deleteButtonText: { color: C.error, fontSize: 12, fontWeight: "600" },
  progressTrack: { height: 7, borderRadius: 7, backgroundColor: C.raised, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: C.accent },
  progressValue: { color: C.muted, fontSize: 11, marginTop: 6 },
  statusRow: { gap: 7, marginTop: 12, marginBottom: 10 },
  statusChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.raised },
  statusChipActive: { borderColor: C.accent, backgroundColor: "rgba(215,184,121,0.12)" },
  statusChipText: { color: C.muted, fontSize: 11 },
  statusChipTextActive: { color: C.accent, fontWeight: "700" },
  progressInput: { width: 90, marginBottom: 0 },
  smallButton: { width: 44, height: 42, borderRadius: 10, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  smallButtonText: { color: C.bg, fontSize: 13, fontWeight: "700" },
  milestoneRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  milestoneText: { color: C.text, fontSize: 13, flex: 1 },
  milestoneTextDone: { color: C.muted, textDecorationLine: "line-through" },
  linkButton: { paddingVertical: 4 },
  linkButtonText: { color: C.accent, fontSize: 12, fontWeight: "700" },
  emptyText: { color: C.muted, fontSize: 12, lineHeight: 18, paddingVertical: 8 },
  assetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  assetCard: { width: "47%", backgroundColor: C.raised, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  assetImage: { width: "100%", height: 100 },
  assetFallback: { alignItems: "center", justifyContent: "center" },
  assetRemove: { position: "absolute", top: 5, right: 5 },
  assetLabel: { color: C.text, fontSize: 11, padding: 8 },
  catalogTabs: { flexDirection: "row", gap: 8, marginBottom: 10 },
  catalogTab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: C.raised },
  catalogTabActive: { backgroundColor: "rgba(215,184,121,0.15)" },
  catalogTabText: { color: C.muted, fontSize: 11 },
  catalogTabTextActive: { color: C.accent, fontWeight: "700" },
  catalogRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  catalogRowDisabled: { opacity: 0.4 },
  catalogThumb: { width: 36, height: 36, borderRadius: 8, backgroundColor: C.raised, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  catalogThumbImage: { width: "100%", height: "100%" },
  catalogLabel: { color: C.text, fontSize: 12, flex: 1 },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border },
  noteText: { color: C.text, fontSize: 12, lineHeight: 18, flex: 1 },
  toast: { position: "absolute", left: 16, right: 16, bottom: 24, backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, alignItems: "center" },
  toastText: { color: C.text, fontSize: 12, textAlign: "center" },
});
