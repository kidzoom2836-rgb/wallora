import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Image } from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";

const C = { bg: "#0B0C0F", card: "#14161B", text: "#F7F7F5", muted: "#9296A1", accent: "#D7B879", border: "#292C33", error: "#E46F75", raised: "#1C1F26" };
const API = "http://192.168.100.9:3000";

const STYLES = ["Cinematic", "Minimalist", "Luxury", "Cyberpunk", "Nature", "Futuristic", "Abstract", "Architecture"];
const RATIOS = [
  { label: "1:1", w: 1024, h: 1024 },
  { label: "16:9", w: 1024, h: 576 },
  { label: "9:16", w: 576, h: 1024 },
  { label: "4:3", w: 1024, h: 768 },
];

export default function StudioScreen() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState(STYLES[0]);
  const [ratio, setRatio] = useState(RATIOS[0]);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showStyles, setShowStyles] = useState(false);

  const generate = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/v1/ai/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `${prompt}, ${style} style`, width: ratio.w, height: ratio.h }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Generation failed");
      setImage(data.image);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="color-wand" size={22} color={C.bg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>AI Studio</Text>
            <Text style={styles.sub}>Generate original artwork from text</Text>
          </View>
          <Pressable style={styles.historyBtn}>
            <Ionicons name="time-outline" size={20} color={C.muted} />
          </Pressable>
        </View>

        {/* Prompt */}
        <View style={styles.card}>
          <Text style={styles.label}>Prompt</Text>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="A futuristic luxury bedroom with golden lighting, cinematic, 8k…"
            placeholderTextColor={C.muted}
            style={styles.promptInput}
            multiline
          />
        </View>

        {/* Style selector */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Style</Text>
            <Text style={styles.selectedValue}>{style}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {STYLES.map((s) => {
              const active = style === s;
              return (
                <Pressable key={s} onPress={() => setStyle(s)} style={[styles.styleChip, active && styles.styleChipActive]}>
                  <Text style={[styles.styleChipText, active && styles.styleChipTextActive]}>{s}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Aspect ratio */}
        <View style={styles.card}>
          <Text style={styles.label}>Aspect ratio</Text>
          <View style={styles.ratioRow}>
            {RATIOS.map((r) => {
              const active = ratio.label === r.label;
              return (
                <Pressable key={r.label} onPress={() => setRatio(r)} style={[styles.ratioBtn, active && styles.ratioBtnActive]}>
                  <View style={[styles.ratioPreview, { aspectRatio: r.w / r.h }, active && { borderColor: C.accent }]} />
                  <Text style={[styles.ratioLabel, active && { color: C.accent }]}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Credits */}
        <View style={styles.creditRow}>
          <Ionicons name="flash-outline" size={14} color={C.accent} />
          <Text style={styles.creditText}>Estimated: 1 credit per generation</Text>
        </View>

        {/* Generate button */}
        <Pressable style={[styles.generateBtn, loading && { opacity: 0.6 }]} onPress={generate} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={C.bg} />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="sparkles" size={20} color={C.bg} />
              <Text style={styles.generateText}>Generate</Text>
            </View>
          )}
        </Pressable>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={C.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Preview */}
        <View style={styles.previewCard}>
          {image ? (
            <Image source={{ uri: image }} style={styles.previewImage} />
          ) : (
            <View style={styles.previewEmpty}>
              <Ionicons name="image-outline" size={48} color={C.muted} />
              <Text style={styles.previewEmptyText}>Your generated image will appear here</Text>
            </View>
          )}
        </View>

        {/* Variations hint */}
        {image && (
          <View style={styles.actionsRow}>
            <Pressable style={styles.actionBtn}>
              <Ionicons name="download-outline" size={18} color={C.text} />
              <Text style={styles.actionBtnText}>Save</Text>
            </Pressable>
            <Pressable style={styles.actionBtn}>
              <Ionicons name="copy-outline" size={18} color={C.text} />
              <Text style={styles.actionBtnText}>Variation</Text>
            </Pressable>
            <Pressable style={styles.actionBtn}>
              <Ionicons name="share-outline" size={18} color={C.text} />
              <Text style={styles.actionBtnText}>Share</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "600", color: C.text },
  sub: { fontSize: 13, color: C.muted, marginBottom: 16 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  label: { fontSize: 12, fontWeight: "600", color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  promptInput: { backgroundColor: C.raised, color: C.text, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 90, textAlignVertical: "top", borderWidth: 1, borderColor: C.border },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  selectedValue: { color: C.accent, fontSize: 13, fontWeight: "600" },
  chipRow: { gap: 8 },
  styleChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border },
  styleChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  styleChipText: { color: C.muted, fontSize: 12, fontWeight: "500" },
  styleChipTextActive: { color: C.bg, fontWeight: "600" },
  ratioRow: { flexDirection: "row", gap: 10 },
  ratioBtn: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border },
  ratioBtnActive: { borderColor: C.accent, backgroundColor: C.card },
  ratioPreview: { width: 28, height: 28, borderRadius: 4, borderWidth: 2, borderColor: C.muted },
  ratioLabel: { color: C.muted, fontSize: 11, fontWeight: "600" },
  creditRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  creditText: { color: C.muted, fontSize: 12 },
  generateBtn: { backgroundColor: C.accent, paddingVertical: 15, borderRadius: 12, alignItems: "center", marginBottom: 12 },
  generateText: { color: C.bg, fontWeight: "700", fontSize: 16 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 10, backgroundColor: "rgba(228,111,117,0.1)", borderWidth: 1, borderColor: C.error, marginBottom: 12 },
  errorText: { color: C.error, fontSize: 13, flex: 1 },
  previewCard: { borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  previewImage: { width: "100%", height: 320, resizeMode: "cover" },
  previewEmpty: { height: 260, alignItems: "center", justifyContent: "center", gap: 8 },
  previewEmptyText: { color: C.muted, fontSize: 13 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.card, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  actionBtnText: { color: C.text, fontSize: 13, fontWeight: "500" },
  historyBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
});
