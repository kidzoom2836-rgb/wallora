import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenHeader } from "../components/ui/ScreenHeader";
import { apiJson } from "../lib/api";
import { C, R, S } from "../lib/theme";
import {
  pickImages,
  uploadWallpaperImages,
  type PickedImage,
} from "../lib/uploads";
import { withVerification } from "../lib/verification";

const MIN_DIMENSION = 512;
const MAX_DIMENSION = 8192;
const MAX_VARIATIONS = 3;

type Category = { id: string; name: string; slug: string };

type UploadResult = {
  id: string;
  slug: string;
  title: string;
  status: string;
  variationCount?: number;
};

function imageProblem(image: PickedImage): string | null {
  if (image.fileSize > 10 * 1024 * 1024) return "Images must be smaller than 10MB.";
  // Some Android providers omit dimensions; the server validates the real
  // image bytes again after upload.
  if (!image.width || !image.height) return null;
  if (image.width < MIN_DIMENSION || image.height < MIN_DIMENSION) {
    return `“${image.fileName}” is ${image.width}×${image.height}. Minimum is ${MIN_DIMENSION}×${MIN_DIMENSION}.`;
  }
  if (image.width > MAX_DIMENSION || image.height > MAX_DIMENSION) {
    return `“${image.fileName}” is ${image.width}×${image.height}. Maximum is ${MAX_DIMENSION}×${MAX_DIMENSION}.`;
  }
  return null;
}

export default function UploadScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  useEffect(() => {
    apiJson<Category[]>("/api/v1/categories")
      .then((items) => {
        setCategories(items ?? []);
        setCategoryId((current) => current || items?.[0]?.id || "");
      })
      .catch((e: any) =>
        setNotice({ text: e?.message ?? "Could not load categories.", error: true }),
      );
  }, []);

  const addImages = async (source: "library" | "camera") => {
    const remaining = MAX_VARIATIONS - images.length;
    if (remaining <= 0) return;
    setNotice(null);
    try {
      const picked = await pickImages(source, {
        max: remaining,
        allowsEditing: remaining === 1,
        quality: 0.9,
      });
      if (!picked.length) return;

      for (const image of picked) {
        const problem = imageProblem(image);
        if (problem) {
          setNotice({ text: problem, error: true });
          return;
        }
      }

      const unique = picked.filter(
        (image) => !images.some((current) => current.uri === image.uri),
      );
      if (!unique.length) {
        setNotice({ text: "That image is already selected.", error: true });
        return;
      }
      setImages((current) => [...current, ...unique].slice(0, MAX_VARIATIONS));
      setTitle((current) => {
        if (current) return current;
        return (unique[0].fileName || "WALLORA wallpaper")
          .replace(/\.[^.]+$/, "")
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (letter) => letter.toUpperCase())
          .slice(0, 120);
      });
    } catch (e: any) {
      setNotice({ text: e?.message ?? "Could not open the image picker.", error: true });
    }
  };

  const submit = async () => {
    const cleanTitle = title.trim();
    if (!images.length || cleanTitle.length < 2 || !categoryId) {
      setNotice({
        text: "Add at least one image, a title and a category.",
        error: true,
      });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const completed = await withVerification(async () => {
        const uploaded = await uploadWallpaperImages(images);
        const tags = tagsInput
          .split(",")
          .map((tag) => tag.trim().toLowerCase())
          .filter((tag) => tag.length >= 2 && tag.length <= 30)
          .slice(0, 10);

        return apiJson<UploadResult>("/api/v1/uploads/complete", {
          method: "POST",
          body: JSON.stringify({
            sources: uploaded.sources,
            groupId: uploaded.groupId,
            title: cleanTitle,
            categoryId,
            description: description.trim() || undefined,
            tags,
          }),
        });
      });

      if (!completed) {
        setNotice({
          text: "Claim your free WALLORA tick to publish wallpapers.",
          error: true,
        });
        return;
      }
      setResult(completed);
      setImages([]);
      setTitle("");
      setDescription("");
      setTagsInput("");
    } catch (e: any) {
      setNotice({ text: e?.message ?? "Could not publish the wallpaper.", error: true });
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Upload complete" subtitle="Submitted for review" />
        <View style={styles.resultWrap}>
          <View style={styles.resultIcon}>
            <Ionicons name="checkmark-circle" size={44} color={C.success} />
          </View>
          <Text style={styles.resultTitle}>Your wallpaper is in the queue</Text>
          <Text style={styles.resultBody}>
            {result.title} · {result.variationCount ?? 1} variation
            {(result.variationCount ?? 1) > 1 ? "s" : ""}. Approved wallpapers appear in Discover.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.replace("/my-uploads")}>
            <Ionicons name="cloud-upload-outline" size={17} color={C.bg} />
            <Text style={styles.primaryButtonText}>View my uploads</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => setResult(null)}>
            <Text style={styles.secondaryButtonText}>Upload another</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Publish wallpaper"
        subtitle="Add up to three variations"
        right={
          <Pressable onPress={() => router.push("/my-uploads")} hitSlop={8} style={styles.headerAction}>
            <Ionicons name="list-outline" size={19} color={C.accent} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark-outline" size={18} color={C.accent} />
          <Text style={styles.infoText}>
            JPEG, PNG or WebP · up to 10MB each · 512–8192 px. New uploads are reviewed before they
            appear publicly.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Images ({images.length}/{MAX_VARIATIONS})</Text>
        <View style={styles.imageGrid}>
          {images.map((image, index) => (
            <View key={`${image.uri}-${index}`} style={styles.imageTile}>
              <Image source={{ uri: image.uri }} style={styles.imagePreview} resizeMode="cover" />
              <View style={styles.variationBadge}>
                <Text style={styles.variationBadgeText}>{index + 1}</Text>
              </View>
              <Pressable
                hitSlop={6}
                disabled={busy}
                onPress={() => setImages((current) => current.filter((_, i) => i !== index))}
                style={styles.imageRemove}
              >
                <Ionicons name="close" size={14} color={C.text} />
              </Pressable>
            </View>
          ))}
          {images.length < MAX_VARIATIONS && (
            <Pressable
              style={styles.addTile}
              disabled={busy}
              onPress={() => void addImages("library")}
            >
              <Ionicons name="add" size={26} color={C.accent} />
              <Text style={styles.addTileText}>Add image</Text>
            </Pressable>
          )}
        </View>
        {images.length < MAX_VARIATIONS && (
          <Pressable style={styles.cameraLink} disabled={busy} onPress={() => void addImages("camera")}>
            <Ionicons name="camera-outline" size={15} color={C.accent} />
            <Text style={styles.cameraLinkText}>Take a photo instead</Text>
          </Pressable>
        )}

        <Text style={styles.sectionLabel}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Golden abstract waves"
          placeholderTextColor={C.mutedDark}
          style={styles.input}
          maxLength={120}
          editable={!busy}
        />

        <Text style={styles.sectionLabel}>Category</Text>
        {categories.length === 0 ? (
          <Text style={styles.hint}>Loading categories…</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
            {categories.map((category) => (
              <Pressable
                key={category.id}
                onPress={() => setCategoryId(category.id)}
                style={[
                  styles.categoryChip,
                  categoryId === category.id && styles.categoryChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    categoryId === category.id && styles.categoryChipTextActive,
                  ]}
                >
                  {category.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <Text style={styles.sectionLabel}>Description (optional)</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Tell the community about this design…"
          placeholderTextColor={C.mutedDark}
          style={[styles.input, styles.textArea]}
          multiline
          maxLength={2000}
          editable={!busy}
        />

        <Text style={styles.sectionLabel}>Tags (optional)</Text>
        <TextInput
          value={tagsInput}
          onChangeText={setTagsInput}
          placeholder="gold, abstract, amoled"
          placeholderTextColor={C.mutedDark}
          style={styles.input}
          editable={!busy}
        />
        <Text style={styles.hint}>Separate tags with commas. Up to 10.</Text>

        {notice && (
          <View style={[styles.notice, notice.error && styles.noticeError]}>
            <Ionicons
              name={notice.error ? "alert-circle-outline" : "checkmark-circle-outline"}
              size={16}
              color={notice.error ? C.error : C.success}
            />
            <Text style={[styles.noticeText, notice.error && styles.noticeTextError]}>
              {notice.text}
            </Text>
          </View>
        )}

        <Pressable
          style={[
            styles.primaryButton,
            (busy || !images.length || !categoryId || title.trim().length < 2) &&
              styles.buttonDisabled,
          ]}
          disabled={busy || !images.length || !categoryId || title.trim().length < 2}
          onPress={() => void submit()}
        >
          {busy ? (
            <>
              <ActivityIndicator color={C.bg} size="small" />
              <Text style={styles.primaryButtonText}>Uploading & processing…</Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={17} color={C.bg} />
              <Text style={styles.primaryButtonText}>Publish wallpaper</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: S.lg, paddingBottom: S.xxxl },
  infoCard: {
    flexDirection: "row",
    gap: 9,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: S.md,
    marginBottom: S.lg,
  },
  infoText: { flex: 1, color: C.muted, fontSize: 12, lineHeight: 18 },
  sectionLabel: {
    color: C.text,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: S.sm,
    marginTop: S.md,
  },
  imageGrid: { flexDirection: "row", gap: S.sm, flexWrap: "wrap" },
  imageTile: {
    width: 96,
    height: 112,
    borderRadius: R.md,
    overflow: "hidden",
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
  },
  imagePreview: { width: "100%", height: "100%" },
  variationBadge: {
    position: "absolute",
    left: 6,
    bottom: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  variationBadgeText: { color: C.bg, fontSize: 10, fontWeight: "800" },
  imageRemove: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.overlay,
    alignItems: "center",
    justifyContent: "center",
  },
  addTile: {
    width: 96,
    height: 112,
    borderRadius: R.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addTileText: { color: C.accent, fontSize: 11, fontWeight: "700" },
  cameraLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: S.sm },
  cameraLinkText: { color: C.accent, fontSize: 12, fontWeight: "600" },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: 12,
    color: C.text,
    fontSize: 14,
  },
  textArea: { minHeight: 90, textAlignVertical: "top", lineHeight: 20 },
  hint: { color: C.muted, fontSize: 11, marginTop: 6, lineHeight: 16 },
  categoryRow: { marginHorizontal: -S.lg, paddingHorizontal: S.lg },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: R.pill,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
    marginRight: 8,
  },
  categoryChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  categoryChipText: { color: C.muted, fontSize: 12, fontWeight: "700" },
  categoryChipTextActive: { color: C.bg },
  notice: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: C.successDim,
    borderRadius: R.md,
    padding: S.md,
    marginTop: S.lg,
  },
  noticeError: { backgroundColor: C.errorDim },
  noticeText: { flex: 1, color: C.success, fontSize: 12, lineHeight: 18 },
  noticeTextError: { color: C.error },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: R.md,
    paddingVertical: 14,
    marginTop: S.xl,
  },
  primaryButtonText: { color: C.bg, fontSize: 14, fontWeight: "800" },
  buttonDisabled: { opacity: 0.45 },
  secondaryButton: { alignItems: "center", paddingVertical: 14, marginTop: S.sm },
  secondaryButtonText: { color: C.accent, fontSize: 13, fontWeight: "700" },
  headerAction: { width: 38, height: 38, borderRadius: R.md, alignItems: "center", justifyContent: "center", backgroundColor: C.raised },
  resultWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: S.xl },
  resultIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: C.successDim,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: S.lg,
  },
  resultTitle: { color: C.text, fontSize: 20, fontWeight: "800", textAlign: "center" },
  resultBody: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: S.sm,
    marginBottom: S.xl,
  },
});
