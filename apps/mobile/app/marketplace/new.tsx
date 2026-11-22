import { useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Switch,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { apiJson } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { C, R, S } from "../../lib/theme";
import { pickImages, uploadImages, type PickedImage } from "../../lib/uploads";
import { withVerification } from "../../lib/verification";

const LICENSES = ["Personal", "Commercial", "Extended"] as const;
type License = (typeof LICENSES)[number];

type CreatedProduct = { id?: string };

/** Product covers use the web app's dedicated multipart endpoint. */
async function uploadProductCover(image: PickedImage): Promise<string> {
  // Store through the shared WALLORA upload pipeline first so the URL is
  // always resolvable by the app, even if the cover endpoint is unavailable.
  const [uploaded] = await uploadImages([image]);
  let url = uploaded?.publicUrl;

  try {
    const form = new FormData();
    form.append("file", {
      uri: image.uri,
      name: image.fileName,
      type: image.mimeType,
    } as unknown as Blob);
    const result = await apiJson<{ url?: string }>("/api/v1/products/image", {
      method: "POST",
      body: form,
      rawBody: true,
    });
    if (result?.url) url = result.url;
  } catch (e: any) {
    if (e?.status === 401) throw e;
    // Keep the presigned upload URL — the image was already stored.
  }

  if (!url) throw new Error("The cover upload did not return a URL.");
  return url;
}

export default function NewListingScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [license, setLicense] = useState<License>("Personal");
  const [isPublished, setIsPublished] = useState(true);
  const [cover, setCover] = useState<PickedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: "error" | "success" | "info" } | null>(null);
  const priceCents = Math.round(Number(price) * 100);

  const pickCover = async () => {
    if (!user) {
      setNotice({ message: "Sign in to add a cover image.", tone: "info" });
      return;
    }
    setNotice(null);
    try {
      const allowed = await withVerification(async () => {
        const images = await pickImages("library", { max: 1, aspect: [4, 3] });
        if (images[0]) setCover(images[0]);
        return true;
      });
      if (allowed === undefined) {
        setNotice({ message: "Claim your free WALLORA tick to add a cover.", tone: "info" });
      }
    } catch (e: any) {
      setNotice({ message: e?.message ?? "Could not open the image picker.", tone: "error" });
    }
  };

  const submit = async () => {
    if (busy) return;
    setNotice(null);

    const trimmedTitle = title.trim();
    const cents = priceCents;
    if (trimmedTitle.length < 1 || trimmedTitle.length > 120) {
      setNotice({ message: "Add a title between 1 and 120 characters.", tone: "error" });
      return;
    }
    if (!price.trim() || !Number.isFinite(cents) || cents < 0 || cents > 10_000_000) {
      setNotice({ message: "Price must be between $0 and $100,000.", tone: "error" });
      return;
    }
    if (description.trim().length > 2000) {
      setNotice({ message: "Description must be at most 2000 characters.", tone: "error" });
      return;
    }
    if (!user) {
      setNotice({ message: "Sign in to create a marketplace listing.", tone: "info" });
      return;
    }

    setBusy(true);
    try {
      const created = await withVerification(async () => {
        const coverUrl = cover ? await uploadProductCover(cover) : null;
        return apiJson<CreatedProduct>("/api/v1/products", {
          method: "POST",
          body: JSON.stringify({
            title: trimmedTitle,
            description: description.trim(),
            price: cents,
            license,
            coverUrl,
            isPublished,
          }),
        });
      });
      if (created === undefined) {
        setNotice({ message: "Claim your free WALLORA tick to publish a listing.", tone: "info" });
        return;
      }
      router.push("/marketplace/manage");
    } catch (e: any) {
      setNotice({
        message: e?.status === 401 ? "Your session expired. Sign in again." : (e?.message ?? "Could not save the listing."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const coverSource = cover?.uri ? { uri: cover.uri } : null;

  return (
    <View style={styles.root}>
      <ScreenHeader title="New listing" subtitle="Seller tools" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>SELLER TOOLS</Text>
        <Text style={styles.heading}>Create a listing</Text>
        <Text style={styles.lead}>
          Add a real pack with a clear license and price. You can edit, unpublish or delete it any time.
        </Text>

        {authLoading ? (
          <View style={styles.state}>
            <ActivityIndicator color={C.accent} />
            <Text style={styles.stateText}>Checking your session…</Text>
          </View>
        ) : null}

        {!authLoading && !user ? (
          <Pressable style={styles.signInCard} onPress={() => router.push("/auth/login")}>
            <Ionicons name="lock-closed-outline" size={17} color={C.accent} />
            <Text style={styles.signInText}>Sign in to create a marketplace listing.</Text>
            <Ionicons name="chevron-forward" size={16} color={C.accent} />
          </Pressable>
        ) : null}

        {notice ? (
          <View
            style={[
              styles.notice,
              {
                borderColor:
                  notice.tone === "success" ? C.success + "55" : notice.tone === "info" ? C.blue + "55" : C.error + "55",
              },
            ]}
          >
            <Ionicons
              name={
                notice.tone === "success"
                  ? "checkmark-circle-outline"
                  : notice.tone === "info"
                    ? "information-circle-outline"
                    : "alert-circle-outline"
              }
              size={16}
              color={notice.tone === "success" ? C.success : notice.tone === "info" ? C.blue : C.error}
            />
            <Text style={styles.noticeText}>{notice.message}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Neon Horizon — 12 wallpapers"
            placeholderTextColor={C.mutedDark}
            style={styles.input}
            maxLength={120}
            editable={!busy}
          />

          <View style={styles.labelRow}>
            <Text style={styles.label}>Description</Text>
            <Text style={styles.counter}>{description.length}/2000</Text>
          </View>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What's included, formats, resolution and usage terms."
            placeholderTextColor={C.mutedDark}
            style={[styles.input, styles.textArea]}
            multiline
            maxLength={2000}
            editable={!busy}
          />

          <Text style={styles.label}>Price (USD)</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            placeholderTextColor={C.mutedDark}
            style={styles.input}
            keyboardType="decimal-pad"
            returnKeyType="done"
            editable={!busy}
          />
          <Text style={styles.hint}>Stored as {Number.isFinite(priceCents) && priceCents > 0 ? priceCents : 0} cents. Use 0 for a free pack.</Text>

          <Text style={[styles.label, styles.sectionGap]}>License</Text>
          <View style={styles.chipRow}>
            {LICENSES.map((value) => (
              <Pressable
                key={value}
                onPress={() => setLicense(value)}
                disabled={busy}
                style={[styles.chip, license === value && styles.chipActive]}
              >
                <Text style={[styles.chipText, license === value && styles.chipTextActive]}>{value}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, styles.sectionGap]}>Cover image</Text>
          <View style={styles.coverRow}>
            <View style={styles.coverPreview}>
              {coverSource ? (
                <Image source={coverSource} style={styles.coverImage} resizeMode="cover" />
              ) : (
                <Ionicons name="image-outline" size={28} color={C.mutedDark} />
              )}
            </View>
            <View style={styles.coverActions}>
              <Pressable onPress={() => void pickCover()} disabled={busy} style={styles.secondaryButton}>
                <Ionicons name="cloud-upload-outline" size={16} color={C.accent} />
                <Text style={styles.secondaryButtonText}>{cover ? "Replace cover" : "Choose cover"}</Text>
              </Pressable>
              {cover ? (
                <Pressable onPress={() => setCover(null)} disabled={busy} hitSlop={8}>
                  <Text style={styles.removeText}>Remove cover</Text>
                </Pressable>
              ) : null}
              <Text style={styles.hint}>JPEG, PNG or WebP. Covers are normalized and stored in WALLORA.</Text>
            </View>
          </View>

          <Pressable
            onPress={() => setIsPublished((value) => !value)}
            disabled={busy}
            style={styles.publishRow}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.publishTitle}>Publish now</Text>
              <Text style={styles.hint}>Unpublished listings stay in your manager only.</Text>
            </View>
            <Switch
              value={isPublished}
              onValueChange={setIsPublished}
              disabled={busy}
              trackColor={{ false: C.raised, true: C.accent }}
              thumbColor={isPublished ? C.bg : C.text}
              ios_backgroundColor={C.raised}
            />
          </Pressable>

          <View style={styles.verificationNote}>
            <Ionicons name="shield-checkmark-outline" size={15} color={C.accent} />
            <Text style={styles.verificationText}>
              Creating and publishing require a verified WALLORA account. Purchases in this demo record real
              entitlements; no payment gateway is connected.
            </Text>
          </View>

          <View style={styles.footer}>
            <Pressable onPress={() => router.back()} disabled={busy} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => void submit()}
              disabled={busy || authLoading}
              style={[styles.primaryButton, busy && styles.buttonDisabled]}
            >
              {busy ? (
                <ActivityIndicator color={C.bg} size="small" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={17} color={C.bg} />
                  <Text style={styles.primaryButtonText}>{isPublished ? "Publish listing" : "Save draft"}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: S.lg, paddingBottom: S.xxxl },
  eyebrow: { fontSize: 10, letterSpacing: 1.6, color: C.accent, fontWeight: "800", marginBottom: 4 },
  heading: { fontSize: 25, fontWeight: "800", color: C.text },
  lead: { fontSize: 12, color: C.muted, lineHeight: 18, marginTop: 5 },
  state: { flexDirection: "row", alignItems: "center", gap: S.sm, paddingVertical: S.xl },
  stateText: { color: C.muted, fontSize: 12 },
  signInCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accent + "44",
    borderRadius: R.md,
    padding: S.md,
    marginTop: S.lg,
  },
  signInText: { flex: 1, color: C.textSoft, fontSize: 12 },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: S.sm,
    backgroundColor: C.card,
    borderWidth: 1,
    borderRadius: R.md,
    padding: S.md,
    marginTop: S.md,
  },
  noticeText: { flex: 1, color: C.textSoft, fontSize: 12, lineHeight: 18 },
  form: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: S.md,
    marginTop: S.lg,
  },
  label: { color: C.text, fontSize: 12, fontWeight: "800", marginBottom: 7 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  counter: { color: C.mutedDark, fontSize: 10, marginBottom: 7 },
  input: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: 11,
    color: C.text,
    fontSize: 14,
    marginBottom: S.md,
  },
  textArea: { minHeight: 100, textAlignVertical: "top", lineHeight: 20 },
  hint: { color: C.muted, fontSize: 11, lineHeight: 16 },
  sectionGap: { marginTop: S.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: S.sm, marginBottom: S.md },
  chip: {
    paddingHorizontal: S.md,
    paddingVertical: 8,
    borderRadius: R.pill,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.muted, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: C.bg },
  coverRow: { flexDirection: "row", gap: S.md, alignItems: "flex-start", marginBottom: S.md },
  coverPreview: {
    width: 108,
    height: 80,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  coverImage: { width: "100%", height: "100%" },
  coverActions: { flex: 1, gap: S.sm },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.raised,
  },
  secondaryButtonText: { color: C.accent, fontSize: 12, fontWeight: "800" },
  removeText: { color: C.error, fontSize: 11, fontWeight: "700" },
  publishRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.md,
    backgroundColor: C.raised,
    borderRadius: R.md,
    padding: S.md,
  },
  publishTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  verificationNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: S.sm,
    backgroundColor: C.accentDim,
    borderRadius: R.md,
    padding: S.md,
    marginTop: S.md,
  },
  verificationText: { flex: 1, color: C.textSoft, fontSize: 11, lineHeight: 17 },
  footer: { flexDirection: "row", gap: S.sm, borderTopWidth: 1, borderTopColor: C.border, paddingTop: S.md, marginTop: S.lg },
  cancelButton: {
    paddingHorizontal: S.lg,
    paddingVertical: 12,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: "center",
  },
  cancelText: { color: C.muted, fontSize: 13, fontWeight: "700" },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: S.sm,
    backgroundColor: C.accent,
    borderRadius: R.md,
    paddingVertical: 12,
  },
  primaryButtonText: { color: C.bg, fontSize: 13, fontWeight: "800" },
  buttonDisabled: { opacity: 0.6 },
});
