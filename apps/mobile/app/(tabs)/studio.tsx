import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Image, Switch } from "react-native";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { apiJson } from "../../lib/api";
import { assetUrl } from "../../lib/config";

const C = { bg: "#0B0C0F", card: "#14161B", raised: "#1C1F26", text: "#F7F7F5", muted: "#9296A1", accent: "#D7B879", border: "#292C33", error: "#E46F75" };

interface Preset { id: string; name: string; description?: string; }
interface Aspect { id: "square" | "portrait" | "landscape"; label: string; ratio: string; size: string; }
interface Generation {
  id: string;
  prompt: string;
  stylePreset: string;
  aspectRatio: string;
  status: string;
  publicUrl?: string;
  width?: number;
  height?: number;
  creditsUsed?: number;
  createdAt: string;
}

const SUGGESTIONS = [
  "A futuristic luxury bedroom with golden light above a neon city",
  "Minimalist dark wallpaper with subtle gold geometric lines",
  "Abstract liquid gold flowing through charcoal texture",
];

export default function StudioScreen() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [aspects, setAspects] = useState<Aspect[]>([]);
  const [cost, setCost] = useState<Record<string, number>>({});
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("none");
  const [aspect, setAspect] = useState<"square" | "portrait" | "landscape">("portrait");
  const [enhance, setEnhance] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Generation | null>(null);
  const [history, setHistory] = useState<Generation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiJson<{ stylePresets: Preset[]; aspectRatios: Aspect[]; generationCost: Record<string, number> }>("/api/v1/ai/presets")
      .then((d) => {
        setPresets(d.stylePresets ?? []);
        setAspects(d.aspectRatios ?? []);
        setCost(d.generationCost ?? {});
      })
      .catch(() => {});
    apiJson<{ items: Generation[] }>("/api/v1/ai/generations?limit=6")
      .then((d) => setHistory(d.items ?? []))
      .catch(() => {});
  }, []);

  const generate = async () => {
    if (prompt.trim().length < 3 || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiJson<Generation>("/api/v1/ai/generations", {
        method: "POST",
        body: JSON.stringify({
          prompt: prompt.trim(),
          stylePreset: style,
          aspectRatio: aspect,
          enhance,
        }),
      });
      setResult(data);
      setHistory((h) => [data, ...h].slice(0, 6));
    } catch (e: any) {
      const msg = e?.message ?? "Generation failed.";
      const remaining = e?.payload?.error?.remaining;
      setError(remaining != null ? `${msg} (${remaining} credits left today)` : msg);
    } finally {
      setLoading(false);
    }
  };

  const shown = result;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerIcon}><Ionicons name="color-wand" size={22} color={C.bg} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>AI Studio</Text>
            <Text style={styles.sub}>Turn an idea into original artwork</Text>
          </View>
          <View style={styles.costBadge}>
            <Ionicons name="flash-outline" size={12} color={C.accent} />
            <Text style={styles.costText}>{cost[aspect] ?? 5}</Text>
          </View>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={C.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {shown?.publicUrl ? (
          <View style={styles.resultCard}>
            <Image source={{ uri: assetUrl(shown.publicUrl) }} style={styles.resultImage} resizeMode="cover" />
            <View style={styles.resultOverlay}>
              <Text style={styles.resultLabel}>GENERATED</Text>
              <Text style={styles.resultPrompt} numberOfLines={2}>{shown.prompt}</Text>
            </View>
          </View>
        ) : loading ? (
          <View style={styles.generating}>
            <View style={styles.genOrb}><Ionicons name="sparkles" size={30} color={C.accent} /></View>
            <ActivityIndicator color={C.accent} size="large" />
            <Text style={styles.genTitle}>Creating your image…</Text>
            <Text style={styles.genSub}>This usually takes a few seconds</Text>
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="image-outline" size={38} color={C.muted} />
            <Text style={styles.placeholderText}>Your creation will appear here</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.label}>PROMPT</Text>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Describe the image you want to create…"
            placeholderTextColor={C.muted}
            style={styles.promptInput}
            multiline
            maxLength={2000}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} style={styles.suggestion} onPress={() => setPrompt(s)}>
                <Text style={styles.suggestionText} numberOfLines={2}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>STYLE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.styleRow}>
            {(presets.length ? presets : [{ id: "none", name: "No preset" }]).map((p) => (
              <Pressable key={p.id} onPress={() => setStyle(p.id)} style={[styles.styleChip, style === p.id && styles.styleChipActive]}>
                <Text style={[styles.styleText, style === p.id && styles.styleTextActive]}>{p.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>ASPECT RATIO</Text>
          <View style={styles.aspectRow}>
            {(aspects.length ? aspects : [
              { id: "square" as const, label: "Square", ratio: "1:1", size: "1024x1024" },
              { id: "portrait" as const, label: "Portrait", ratio: "9:16", size: "768x1344" },
              { id: "landscape" as const, label: "Landscape", ratio: "16:9", size: "1344x768" },
            ]).map((a) => (
              <Pressable
                key={a.id}
                onPress={() => setAspect(a.id as typeof aspect)}
                style={[styles.aspectCard, aspect === a.id && styles.aspectCardActive]}
              >
                <View style={[styles.aspectShape, { width: a.id === "landscape" ? 30 : a.id === "portrait" ? 17 : 24, height: a.id === "landscape" ? 17 : a.id === "portrait" ? 30 : 24 }, aspect === a.id && styles.aspectShapeActive]} />
                <Text style={[styles.aspectLabel, aspect === a.id && styles.aspectLabelActive]}>{a.label}</Text>
                <Text style={styles.aspectSize}>{a.ratio} · {a.size}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.enhanceRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.enhanceTitle}>Enhance prompt</Text>
              <Text style={styles.enhanceSub}>Let AI refine your idea first (1 credit)</Text>
            </View>
            <Switch value={enhance} onValueChange={setEnhance} trackColor={{ false: C.raised, true: C.accent }} thumbColor={C.text} />
          </View>
        </View>

        <Pressable style={[styles.generateBtn, (loading || prompt.trim().length < 3) && styles.generateDisabled]} onPress={generate} disabled={loading || prompt.trim().length < 3}>
          {loading ? <ActivityIndicator color={C.bg} /> : <><Ionicons name="sparkles" size={18} color={C.bg} /><Text style={styles.generateText}>Generate artwork</Text></>}
        </Pressable>

        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Recent creations</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyRow}>
              {history.filter((h) => h.status === "completed" && h.publicUrl).map((h) => (
                <Pressable key={h.id} style={styles.historyItem} onPress={() => setResult(h)}>
                  <Image source={{ uri: assetUrl(h.publicUrl) }} style={styles.historyImage} resizeMode="cover" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 30 },
  header: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 16 },
  headerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  title: { color: C.text, fontSize: 22, fontWeight: "700" },
  sub: { color: C.muted, fontSize: 12, marginTop: 2 },
  costBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  costText: { color: C.accent, fontSize: 12, fontWeight: "700" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(228,111,117,0.1)", borderWidth: 1, borderColor: C.error, borderRadius: 10, padding: 11, marginBottom: 14 },
  errorText: { color: C.error, fontSize: 12, flex: 1 },
  placeholder: { height: 230, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14 },
  placeholderText: { color: C.muted, fontSize: 13 },
  generating: { height: 230, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.accent, alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 14 },
  genOrb: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.raised, alignItems: "center", justifyContent: "center" },
  genTitle: { color: C.text, fontSize: 15, fontWeight: "700" },
  genSub: { color: C.muted, fontSize: 12 },
  resultCard: { height: 260, borderRadius: 18, overflow: "hidden", marginBottom: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  resultImage: { width: "100%", height: "100%" },
  resultOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: "rgba(11,12,15,0.7)" },
  resultLabel: { color: C.accent, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  resultPrompt: { color: C.text, fontSize: 13, marginTop: 4 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 12 },
  label: { color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 9 },
  promptInput: { color: C.text, fontSize: 14, lineHeight: 20, minHeight: 72, textAlignVertical: "top" },
  suggestions: { gap: 7, marginTop: 10 },
  suggestion: { maxWidth: 190, backgroundColor: C.raised, borderRadius: 9, padding: 9, borderWidth: 1, borderColor: C.border },
  suggestionText: { color: C.muted, fontSize: 11, lineHeight: 15 },
  styleRow: { gap: 7 },
  styleChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 9, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border },
  styleChipActive: { borderColor: C.accent, backgroundColor: "rgba(215,184,121,0.1)" },
  styleText: { color: C.muted, fontSize: 12, fontWeight: "600" },
  styleTextActive: { color: C.accent },
  aspectRow: { flexDirection: "row", gap: 8 },
  aspectCard: { flex: 1, alignItems: "center", gap: 6, backgroundColor: C.raised, borderRadius: 11, padding: 12, borderWidth: 1, borderColor: C.border },
  aspectCardActive: { borderColor: C.accent, backgroundColor: "rgba(215,184,121,0.08)" },
  aspectShape: { borderRadius: 3, borderWidth: 2, borderColor: C.muted, marginBottom: 2 },
  aspectShapeActive: { borderColor: C.accent },
  aspectLabel: { color: C.muted, fontSize: 12, fontWeight: "700" },
  aspectLabelActive: { color: C.accent },
  aspectSize: { color: C.muted, fontSize: 9 },
  enhanceRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  enhanceTitle: { color: C.text, fontSize: 14, fontWeight: "700" },
  enhanceSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: C.accent, borderRadius: 14, paddingVertical: 16, marginTop: 2 },
  generateDisabled: { opacity: 0.45 },
  generateText: { color: C.bg, fontWeight: "800", fontSize: 15 },
  historySection: { marginTop: 18 },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: "700", marginBottom: 10 },
  historyRow: { gap: 9 },
  historyItem: { width: 82, height: 82, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  historyImage: { width: "100%", height: "100%" },
});
