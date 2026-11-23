import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";

import { apiJson } from "../../lib/api";
import { assetUrl } from "../../lib/config";
import { pickImages } from "../../lib/uploads";
import {
  AI_ATTACHMENT_MAX_FILES,
  uploadAiAttachments,
  validateAiFiles,
  type LocalAiFile,
} from "../../lib/aiAttachments";
import { withVerification } from "../../lib/verification";
import { addAsWallpaper, downloadWallpaper } from "../../lib/downloads";
import { C, R } from "../../lib/theme";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Notice } from "../../components/ui/Notice";

interface Preset {
  id: string;
  name: string;
  description?: string;
}

interface Aspect {
  id: "square" | "portrait" | "landscape";
  label: string;
  ratio: string;
  size: string;
}

interface Generation {
  id: string;
  prompt: string;
  enhancedPrompt?: string | null;
  stylePreset: string;
  aspectRatio: string;
  status: string;
  objectKey?: string | null;
  publicUrl?: string | null;
  width?: number;
  height?: number;
  creditsUsed?: number;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
}

const SELECTED_KEY = "wallora.studio.selected.v1";

const SUGGESTIONS = [
  "A futuristic luxury bedroom with golden light above a neon city",
  "Minimalist dark wallpaper with subtle gold geometric lines",
  "Abstract liquid gold flowing through charcoal texture",
];

export default function StudioScreen() {
  const insets = useSafeAreaInsets();
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
  const [notice, setNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [referenceFiles, setReferenceFiles] = useState<LocalAiFile[]>([]);
  const [showReferencePicker, setShowReferencePicker] = useState(false);

  const selectResult = useCallback((gen: Generation | null) => {
    setResult(gen);
    if (gen) AsyncStorage.setItem(SELECTED_KEY, gen.id).catch(() => {});
    else AsyncStorage.removeItem(SELECTED_KEY).catch(() => {});
  }, []);

  const loadHistory = useCallback(async () => {
    const data = await apiJson<{ items: Generation[] }>("/api/v1/ai/generations?limit=12");
    const items = data.items ?? [];
    setHistory(items);
    const savedId = await AsyncStorage.getItem(SELECTED_KEY).catch(() => null);
    const saved = savedId ? items.find((item) => item.id === savedId) : null;
    if (saved) selectResult(saved);
  }, [selectResult]);

  useEffect(() => {
    apiJson<{ stylePresets: Preset[]; aspectRatios: Aspect[]; generationCost: Record<string, number> }>(
      "/api/v1/ai/presets",
    )
      .then((d) => {
        setPresets(d.stylePresets ?? []);
        setAspects(d.aspectRatios ?? []);
        setCost(d.generationCost ?? {});
      })
      .catch(() => {});
    loadHistory().catch(() => {});
  }, [loadHistory]);

  const addReferenceFiles = (files: LocalAiFile[]) => {
    if (!files.length) return;
    try {
      const next = [...referenceFiles, ...files].slice(0, AI_ATTACHMENT_MAX_FILES);
      validateAiFiles(next);
      setReferenceFiles(next);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Could not add those references.");
    } finally {
      setShowReferencePicker(false);
    }
  };

  const pickReferencePhotos = async (source: "library" | "camera") => {
    setShowReferencePicker(false);
    try {
      const images = await pickImages(source, {
        max: AI_ATTACHMENT_MAX_FILES - referenceFiles.length,
        allowsEditing: false,
        quality: 0.82,
      });
      addReferenceFiles(
        images.map((image) => ({
          uri: image.uri,
          name: image.fileName,
          type: image.mimeType,
          size: image.fileSize,
        })),
      );
    } catch (e: any) {
      setError(e?.message ?? "Could not choose that photo.");
    }
  };

  const pickReferenceDocuments = async () => {
    setShowReferencePicker(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "text/plain", "text/markdown", "text/csv", "application/json"],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      addReferenceFiles(
        result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType,
          size: asset.size,
        })),
      );
    } catch (e: any) {
      setError(e?.message ?? "Could not choose that document.");
    }
  };

  const generate = async () => {
    if (prompt.trim().length < 3 || loading) return;
    const files = referenceFiles;
    setLoading(true);
    setError(null);
    try {
      const data = await withVerification(async () => {
        const uploaded = await uploadAiAttachments(files);
        return apiJson<Generation>("/api/v1/ai/generations", {
          method: "POST",
          body: JSON.stringify({
            prompt: prompt.trim(),
            stylePreset: style,
            aspectRatio: aspect,
            enhance,
            attachmentIds: uploaded.map((attachment) => attachment.id),
          }),
        });
      });
      if (!data) return;
      setReferenceFiles([]);
      selectResult(data);
      setHistory((h) => [data, ...h.filter((item) => item.id !== data.id)].slice(0, 12));
      setNotice(
        files.length
          ? "Artwork generated from your references. Options are ready below."
          : "Artwork generated. Options are ready below.",
      );
    } catch (e: any) {
      const remaining = e?.payload?.error?.remaining;
      const msg = e?.message ?? "Generation failed.";
      setError(remaining != null ? `${msg} (${remaining} credits left today)` : msg);
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    if (!result?.publicUrl) return;
    setBusyAction("download");
    try {
      const saved = await downloadWallpaper({
        id: `gen-${result.id}`,
        title: result.prompt.slice(0, 70),
        remoteUrl: assetUrl(result.publicUrl)!,
        width: result.width,
        height: result.height,
      });
      Alert.alert("Saved to WALLORA Downloads", "Your generated wallpaper is available offline.", [
        { text: "Done" },
        {
          text: "Add as wallpaper",
          onPress: async () => {
            try {
              await addAsWallpaper(saved);
              setNotice("Saved to your WALLORA gallery album");
            } catch (e: any) {
              setNotice(e?.message ?? "Could not save to gallery");
            }
          },
        },
      ]);
    } catch (e: any) {
      setNotice(e?.message ?? "Could not download artwork");
    } finally {
      setBusyAction(null);
    }
  };

  const share = async () => {
    if (!result?.publicUrl) return;
    try {
      await Share.share({
        title: "WALLORA creation",
        message: result.prompt.slice(0, 180),
        url: assetUrl(result.publicUrl),
      });
    } catch {
      /* cancelled */
    }
  };

  const publish = async () => {
    if (!result) return;
    setBusyAction("publish");
    try {
      const published = await withVerification(() =>
        apiJson<{ slug: string; status: string; moderationNote?: string }>(
          `/api/v1/ai/generations/${result.id}/publish`,
          { method: "POST" },
        ),
      );
      if (published) {
        setNotice("Published to WALLORA. It is pending admin review before appearing in Discover.");
        return;
      }
    } catch (e: any) {
      if (e?.status !== 404) {
        setNotice(e?.message ?? "Could not publish artwork");
        setBusyAction(null);
        return;
      }
    }
    // Fallback: publish the generated image as a real community image post.
    try {
      const imageKey =
        result.objectKey ?? result.publicUrl?.match(/gen\/[^?#]+$/i)?.[0] ?? null;
      if (!imageKey) throw new Error("The generated image has no shareable storage key.");
      await withVerification(() =>
        apiJson("/api/v1/community/posts", {
          method: "POST",
          body: JSON.stringify({
            body: result.prompt.slice(0, 2000),
            kind: "image",
            imageKey,
          }),
        }),
      );
      setNotice("Published to the WALLORA community feed.");
    } catch (e: any) {
      setNotice(e?.message ?? "Could not publish artwork");
    } finally {
      setBusyAction(null);
    }
  };

  const addToProject = async () => {
    if (!result) return;
    try {
      const data = await apiJson<{ items: Project[] }>("/api/v1/projects?limit=20");
      const projects = data.items ?? [];
      if (!projects.length) {
        setNotice("Create a project first, then add this artwork to it.");
        return;
      }
      const buttons = projects.slice(0, 4).map((project) => ({
        text: project.name,
        onPress: async () => {
          try {
            await apiJson(`/api/v1/projects/${project.id}/assets`, {
              method: "POST",
              body: JSON.stringify({ assetType: "generation", generationId: result.id }),
            });
            setNotice(`Added to ${project.name}`);
          } catch (e: any) {
            setNotice(e?.message ?? "Could not add to project");
          }
        },
      }));
      Alert.alert("Add to project", "Choose a project for this generation.", [
        ...buttons,
        { text: "Cancel", style: "cancel" },
      ]);
    } catch (e: any) {
      setNotice(e?.message ?? "Could not load projects");
    }
  };

  const retry = async () => {
    if (!result) return;
    setBusyAction("retry");
    try {
      const data = await apiJson<Generation>(`/api/v1/ai/generations/${result.id}/retry`, {
        method: "POST",
      });
      selectResult(data);
      setHistory((h) => [data, ...h.filter((item) => item.id !== data.id)].slice(0, 12));
      setNotice("Generation restarted.");
    } catch (e: any) {
      setNotice(e?.message ?? "Could not retry generation");
    } finally {
      setBusyAction(null);
    }
  };

  const removeGeneration = async () => {
    if (!result) return;
    Alert.alert("Delete generation", "Remove this generation from your WALLORA history?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await apiJson(`/api/v1/ai/generations/${result.id}`, { method: "DELETE" });
            setHistory((h) => h.filter((item) => item.id !== result.id));
            selectResult(null);
            setNotice("Generation deleted.");
          } catch (e: any) {
            setNotice(e?.message ?? "Could not delete generation");
          }
        },
      },
    ]);
  };

  const shown = result;

  return (
    <View style={styles.screen}>
      <Notice message={notice} onDismiss={() => setNotice(null)} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
      >
        <ScreenHeader
          title="AI Studio"
          subtitle="Turn an idea into original artwork"
          showBack={false}
          transparent
          right={
            <View style={styles.costBadge}>
              <Ionicons name="flash-outline" size={12} color={C.accent} />
              <Text style={styles.costText}>{cost[aspect] ?? 5}</Text>
            </View>
          }
        />

        <View style={styles.body}>
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={C.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {shown?.publicUrl ? (
            <View style={styles.resultCard}>
              <Image source={{ uri: assetUrl(shown.publicUrl) }} style={styles.resultImage} resizeMode="cover" />
              <View style={styles.resultGradient} />
              <View style={styles.resultTop}>
                <View style={styles.resultKicker}>
                  <Ionicons name="sparkles" size={12} color={C.bg} />
                  <Text style={styles.resultKickerText}>YOUR GENERATION</Text>
                </View>
                <Text style={styles.resultSize}>
                  {shown.width && shown.height ? `${shown.width}x${shown.height}` : shown.aspectRatio.toUpperCase()}
                </Text>
              </View>
              <View style={styles.resultOverlay}>
                <Text style={styles.resultPrompt} numberOfLines={3}>
                  {shown.prompt}
                </Text>
              </View>
            </View>
          ) : loading ? (
            <View style={styles.generating}>
              <View style={styles.genOrb}>
                <Ionicons name="sparkles" size={30} color={C.accent} />
              </View>
              <ActivityIndicator color={C.accent} size="large" />
              <Text style={styles.genTitle}>Creating your image…</Text>
              <Text style={styles.genSub}>This usually takes a few seconds</Text>
            </View>
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="image-outline" size={38} color={C.muted} />
              <Text style={styles.placeholderText}>Your creation will appear here</Text>
              <Text style={styles.placeholderSub}>Generated artwork stays in your history</Text>
            </View>
          )}

          {shown && (
            <View style={styles.optionsCard}>
              <Text style={styles.optionsTitle}>What next?</Text>
              <View style={styles.optionsGrid}>
                <ActionButton icon="download-outline" label="Download" onPress={download} disabled={!shown.publicUrl} busy={busyAction === "download"} />
                <ActionButton icon="share-outline" label="Share" onPress={share} disabled={!shown.publicUrl} />
                <ActionButton icon="cloud-upload-outline" label="Publish" onPress={publish} busy={busyAction === "publish"} tone="accent" />
                <ActionButton icon="folder-outline" label="Project" onPress={addToProject} />
                <ActionButton icon="refresh-outline" label="Retry" onPress={retry} busy={busyAction === "retry"} />
                <ActionButton icon="trash-outline" label="Delete" onPress={removeGeneration} tone="error" />
              </View>
              <Pressable onPress={() => setPrompt(shown.prompt)} style={styles.reuseRow}>
                <Ionicons name="copy-outline" size={16} color={C.accent} />
                <Text style={styles.reuseText}>Reuse this prompt</Text>
                <Ionicons name="chevron-forward" size={16} color={C.muted} />
              </Pressable>
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
            <Pressable
              onPress={() => setShowReferencePicker(true)}
              disabled={loading || referenceFiles.length >= AI_ATTACHMENT_MAX_FILES}
              style={[styles.referenceButton, (loading || referenceFiles.length >= AI_ATTACHMENT_MAX_FILES) && styles.pressed]}
            >
              <Ionicons name="attach-outline" size={16} color={C.accent} />
              <Text style={styles.referenceButtonText}>
                {referenceFiles.length
                  ? `${referenceFiles.length}/${AI_ATTACHMENT_MAX_FILES} references attached`
                  : "Attach reference photos or documents"}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={C.muted} />
            </Pressable>
            {referenceFiles.length > 0 && (
              <View style={styles.referenceChips}>
                {referenceFiles.map((file, index) => (
                  <Pressable
                    key={`${file.name}-${index}`}
                    onPress={() => setReferenceFiles((prev) => prev.filter((_, i) => i !== index))}
                    style={styles.referenceChip}
                  >
                    <Ionicons
                      name={file.type?.startsWith("image/") ? "image-outline" : "document-outline"}
                      size={13}
                      color={C.accent}
                    />
                    <Text style={styles.referenceChipText} numberOfLines={1}>{file.name}</Text>
                    <Ionicons name="close" size={12} color={C.muted} />
                  </Pressable>
                ))}
              </View>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} style={styles.suggestion} onPress={() => setPrompt(s)}>
                  <Text style={styles.suggestionText} numberOfLines={2}>
                    {s}
                  </Text>
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
              {(aspects.length
                ? aspects
                : [
                    { id: "square" as const, label: "Square", ratio: "1:1", size: "1024x1024" },
                    { id: "portrait" as const, label: "Portrait", ratio: "9:16", size: "768x1344" },
                    { id: "landscape" as const, label: "Landscape", ratio: "16:9", size: "1344x768" },
                  ]
              ).map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => setAspect(a.id as typeof aspect)}
                  style={[styles.aspectCard, aspect === a.id && styles.aspectCardActive]}
                >
                  <View
                    style={[
                      styles.aspectShape,
                      {
                        width: a.id === "landscape" ? 30 : a.id === "portrait" ? 17 : 24,
                        height: a.id === "landscape" ? 17 : a.id === "portrait" ? 30 : 24,
                      },
                      aspect === a.id && styles.aspectShapeActive,
                    ]}
                  />
                  <Text style={[styles.aspectLabel, aspect === a.id && styles.aspectLabelActive]}>{a.label}</Text>
                  <Text style={styles.aspectSize}>
                    {a.ratio} · {a.size}
                  </Text>
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

          <Pressable
            style={[styles.generateBtn, (loading || prompt.trim().length < 3) && styles.generateDisabled]}
            onPress={generate}
            disabled={loading || prompt.trim().length < 3}
          >
            {loading ? (
              <ActivityIndicator color={C.bg} />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color={C.bg} />
                <Text style={styles.generateText}>Generate artwork</Text>
              </>
            )}
          </Pressable>

          {history.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.sectionTitle}>Recent creations</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyRow}>
                {history
                  .filter((h) => h.status === "completed" && h.publicUrl)
                  .map((h) => (
                    <Pressable
                      key={h.id}
                      onPress={() => selectResult(h)}
                      style={[styles.historyItem, result?.id === h.id && styles.historyItemActive]}
                    >
                      <Image source={{ uri: assetUrl(h.publicUrl) }} style={styles.historyImage} resizeMode="cover" />
                    </Pressable>
                  ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showReferencePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReferencePicker(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowReferencePicker(false)}>
          <Pressable style={styles.referenceSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <View style={styles.referenceSheetHeader}>
              <View>
                <Text style={styles.referenceSheetTitle}>Add generation references</Text>
                <Text style={styles.referenceSheetSub}>
                  Aurora reads these as creative direction before it generates your image.
                </Text>
              </View>
              <Pressable onPress={() => setShowReferencePicker(false)} hitSlop={10}>
                <Ionicons name="close" size={20} color={C.muted} />
              </Pressable>
            </View>
            <Pressable style={styles.referenceOption} onPress={() => void pickReferencePhotos("library")}>
              <View style={styles.referenceOptionIcon}>
                <Ionicons name="images-outline" size={18} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.referenceOptionTitle}>Photo library</Text>
                <Text style={styles.referenceOptionSub}>Use existing images as visual direction</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.muted} />
            </Pressable>
            <Pressable style={styles.referenceOption} onPress={() => void pickReferencePhotos("camera")}>
              <View style={styles.referenceOptionIcon}>
                <Ionicons name="camera-outline" size={18} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.referenceOptionTitle}>Camera</Text>
                <Text style={styles.referenceOptionSub}>Capture a real-world reference</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.muted} />
            </Pressable>
            <Pressable style={styles.referenceOption} onPress={() => void pickReferenceDocuments()}>
              <View style={styles.referenceOptionIcon}>
                <Ionicons name="document-attach-outline" size={18} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.referenceOptionTitle}>Documents</Text>
                <Text style={styles.referenceOptionSub}>PDF, TXT, MD, CSV or JSON notes</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.muted} />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
  busy,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: "accent" | "error";
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.actionButton,
        tone === "accent" && styles.actionAccent,
        tone === "error" && styles.actionError,
        (disabled || busy) && styles.actionDisabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={tone === "accent" ? C.bg : C.accent} /> : <Ionicons name={icon} size={18} color={tone === "accent" ? C.bg : tone === "error" ? C.error : C.accent} />}
      <Text style={[styles.actionLabel, tone === "accent" && styles.actionLabelAccent, tone === "error" && styles.actionLabelError]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  body: { paddingHorizontal: 16, paddingTop: 6 },
  costBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.md, paddingHorizontal: 10, paddingVertical: 7 },
  costText: { color: C.accent, fontSize: 12, fontWeight: "700" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.errorDim, borderWidth: 1, borderColor: C.error + "66", borderRadius: R.md, padding: 11, marginBottom: 14 },
  errorText: { color: C.error, fontSize: 12, flex: 1 },
  placeholder: { height: 230, borderRadius: R.lg, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 9, marginBottom: 14 },
  placeholderText: { color: C.textSoft, fontSize: 13, fontWeight: "600" },
  placeholderSub: { color: C.muted, fontSize: 11 },
  generating: { height: 230, borderRadius: R.lg, backgroundColor: C.card, borderWidth: 1, borderColor: C.accent, alignItems: "center", justifyContent: "center", gap: 11, marginBottom: 14 },
  genOrb: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.raised, alignItems: "center", justifyContent: "center" },
  genTitle: { color: C.text, fontSize: 15, fontWeight: "700" },
  genSub: { color: C.muted, fontSize: 12 },
  resultCard: { height: 300, borderRadius: R.lg, overflow: "hidden", marginBottom: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  resultImage: { width: "100%", height: "100%" },
  resultGradient: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.18)" },
  resultTop: { position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultKicker: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.accent, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 5 },
  resultKickerText: { color: C.bg, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  resultSize: { color: C.white, fontSize: 10, fontWeight: "700", backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 8, paddingVertical: 5, borderRadius: R.pill },
  resultOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: "rgba(11,12,15,0.78)" },
  resultPrompt: { color: C.text, fontSize: 13, lineHeight: 18 },
  optionsCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, padding: 14, marginBottom: 14 },
  optionsTitle: { color: C.text, fontSize: 15, fontWeight: "800", marginBottom: 12 },
  optionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionButton: { width: "31%", minHeight: 66, borderRadius: R.md, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", gap: 5 },
  actionAccent: { backgroundColor: C.accent, borderColor: C.accent },
  actionError: { borderColor: C.error + "66", backgroundColor: C.errorDim },
  actionDisabled: { opacity: 0.45 },
  actionLabel: { color: C.textSoft, fontSize: 11, fontWeight: "700" },
  actionLabelAccent: { color: C.bg },
  actionLabelError: { color: C.error },
  reuseRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  reuseText: { flex: 1, color: C.textSoft, fontSize: 12, fontWeight: "600" },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, padding: 14, marginBottom: 12 },
  label: { color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 9 },
  promptInput: { color: C.text, fontSize: 14, lineHeight: 20, minHeight: 72, textAlignVertical: "top" },
  referenceButton: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border, borderRadius: R.md, paddingHorizontal: 11, paddingVertical: 10, marginTop: 4 },
  referenceButtonText: { color: C.accent, fontSize: 11.5, fontWeight: "700", flex: 1 },
  referenceChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  referenceChip: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "100%", backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 6 },
  referenceChipText: { color: C.textSoft, fontSize: 10.5, flexShrink: 1 },
  modalBackdrop: { flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" },
  referenceSheet: { backgroundColor: C.bgElevated, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, borderTopWidth: 1, borderColor: C.border, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: C.raisedHover, alignSelf: "center", marginBottom: 14 },
  referenceSheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  referenceSheetTitle: { color: C.text, fontSize: 16, fontWeight: "800" },
  referenceSheetSub: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 4, maxWidth: 290 },
  referenceOption: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 13, marginBottom: 9 },
  referenceOptionIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center" },
  referenceOptionTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  referenceOptionSub: { color: C.muted, fontSize: 10.5, marginTop: 2 },
  suggestions: { gap: 7, marginTop: 10 },
  suggestion: { maxWidth: 190, backgroundColor: C.raised, borderRadius: R.sm, padding: 9, borderWidth: 1, borderColor: C.border },
  suggestionText: { color: C.muted, fontSize: 11, lineHeight: 15 },
  styleRow: { gap: 7 },
  styleChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: R.sm, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border },
  styleChipActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  styleText: { color: C.muted, fontSize: 12, fontWeight: "600" },
  styleTextActive: { color: C.accent },
  aspectRow: { flexDirection: "row", gap: 8 },
  aspectCard: { flex: 1, alignItems: "center", gap: 5, backgroundColor: C.raised, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: C.border },
  aspectCardActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  aspectShape: { borderRadius: 3, borderWidth: 2, borderColor: C.muted, marginBottom: 2 },
  aspectShapeActive: { borderColor: C.accent },
  aspectLabel: { color: C.muted, fontSize: 12, fontWeight: "700" },
  aspectLabelActive: { color: C.accent },
  aspectSize: { color: C.muted, fontSize: 9 },
  enhanceRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  enhanceTitle: { color: C.text, fontSize: 14, fontWeight: "700" },
  enhanceSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: C.accent, borderRadius: R.lg, paddingVertical: 16, marginTop: 2 },
  generateDisabled: { opacity: 0.45 },
  generateText: { color: C.bg, fontWeight: "800", fontSize: 15 },
  historySection: { marginTop: 18 },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: "700", marginBottom: 10 },
  historyRow: { gap: 9 },
  historyItem: { width: 82, height: 82, borderRadius: R.sm, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  historyItemActive: { borderColor: C.accent, borderWidth: 2 },
  historyImage: { width: "100%", height: "100%" },
  pressed: { opacity: 0.75 },
});
