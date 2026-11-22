import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { apiJson } from "../../lib/api";
import { assetUrl } from "../../lib/config";
import { useAuth } from "../../lib/auth";
import { C, R, S } from "../../lib/theme";
import { pickImages, uploadImages, type PickedImage } from "../../lib/uploads";
import { withVerification } from "../../lib/verification";

type MyProduct = {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  license: string;
  coverUrl?: string | null;
  isPublished: boolean;
  createdAt?: string;
  updatedAt?: string;
  purchaseCount?: number;
};

type Notice = { message: string; tone: "error" | "info" | "success" };

const LICENSES = ["Personal", "Commercial", "Extended"] as const;
type License = (typeof LICENSES)[number];

function priceLabel(cents: number | undefined) {
  const value = typeof cents === "number" ? cents : 0;
  return value === 0 ? "Free" : `$${(value / 100).toFixed(2)}`;
}

function updatedLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `Updated ${date.toLocaleDateString()}`;
}

function noticeColor(tone: Notice["tone"]) {
  return tone === "success" ? C.success : tone === "info" ? C.blue : C.error;
}

async function uploadProductCover(image: PickedImage): Promise<string> {
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
    // The presigned upload already stored the image; keep its URL.
  }

  if (!url) throw new Error("The cover upload did not return a URL.");
  return url;
}

function NoticeBanner({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  const color = noticeColor(notice.tone);
  return (
    <View style={[styles.notice, { borderColor: color + "55" }]}>
      <Ionicons
        name={notice.tone === "success" ? "checkmark-circle-outline" : notice.tone === "info" ? "information-circle-outline" : "alert-circle-outline"}
        size={16}
        color={color}
      />
      <Text style={[styles.noticeText, { color }]}>{notice.message}</Text>
    </View>
  );
}

export default function ManageListingsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<MyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MyProduct | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiJson<{ items?: MyProduct[] }>("/api/v1/products/mine");
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      setError(e?.status === 401 ? "Your session expired. Sign in again." : (e?.message ?? "Could not load your listings."));
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void load();
  }, [authLoading, user, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const togglePublished = async (item: MyProduct) => {
    if (busyId) return;
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await withVerification(async () =>
        apiJson(`/api/v1/products/${encodeURIComponent(item.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ isPublished: !item.isPublished }),
        }),
      );
      if (updated === undefined) {
        setError("Claim your free WALLORA tick to update your listing.");
        return;
      }
      await load();
    } catch (e: any) {
      setError(e?.status === 401 ? "Your session expired. Sign in again." : (e?.message ?? "Could not update the listing."));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = (item: MyProduct) => {
    Alert.alert(
      "Delete listing?",
      `"${item.title}" and its ${item.purchaseCount ?? 0} purchase records will be permanently removed. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void remove(item) },
      ],
    );
  };

  const remove = async (item: MyProduct) => {
    if (busyId) return;
    setBusyId(item.id);
    setError(null);
    try {
      await apiJson(`/api/v1/products/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      setError(e?.status === 401 ? "Your session expired. Sign in again." : (e?.message ?? "Could not delete the listing."));
    } finally {
      setBusyId(null);
    }
  };

  const openEditor = async (item: MyProduct) => {
    const allowed = await withVerification(async () => true);
    if (allowed === undefined) {
      setError("Claim your free WALLORA tick to edit your listing.");
      return;
    }
    setError(null);
    setEditing(item);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="My listings"
        subtitle="Manage your marketplace packs"
        right={
          <Pressable onPress={() => router.push("/marketplace/new")} hitSlop={8} style={styles.addButton}>
            <Ionicons name="add" size={20} color={C.bg} />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      >
        <Text style={styles.eyebrow}>SELLER TOOLS</Text>
        <Text style={styles.heading}>My listings</Text>
        <Text style={styles.lead}>Edit pricing and licenses, publish when you&apos;re ready, or remove a listing permanently.</Text>

        {authLoading ? (
          <View style={styles.state}>
            <ActivityIndicator color={C.accent} size="large" />
            <Text style={styles.stateText}>Checking your session…</Text>
          </View>
        ) : null}

        {!authLoading && !user ? (
          <View style={styles.empty}>
            <Ionicons name="lock-closed-outline" size={30} color={C.muted} />
            <Text style={styles.emptyTitle}>Sign in to manage your listings</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.push("/auth/login")}>
              <Text style={styles.primaryButtonText}>Sign in</Text>
            </Pressable>
          </View>
        ) : null}

        {user && error ? <NoticeBanner notice={{ message: error, tone: "error" }} /> : null}

        {user && !authLoading && loading ? (
          <View style={styles.state}>
            <ActivityIndicator color={C.accent} size="large" />
            <Text style={styles.stateText}>Loading your listings…</Text>
          </View>
        ) : null}

        {user && !authLoading && !loading && items.length === 0 && !error ? (
          <View style={styles.empty}>
            <Ionicons name="pricetags-outline" size={32} color={C.muted} />
            <Text style={styles.emptyTitle}>No listings yet</Text>
            <Text style={styles.emptySub}>Create your first pack to start selling on WALLORA.</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.push("/marketplace/new")}>
              <Text style={styles.primaryButtonText}>Create a listing</Text>
            </Pressable>
          </View>
        ) : null}

        {items.map((item) => {
          const cover = assetUrl(item.coverUrl);
          const disabled = busyId === item.id;
          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.thumb}>
                  {cover ? (
                    <Image source={{ uri: cover }} style={styles.thumbImage} resizeMode="cover" />
                  ) : (
                    <Ionicons name="image-outline" size={22} color={C.mutedDark} />
                  )}
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, item.isPublished ? styles.badgeLive : styles.badgeDraft]}>
                      <Text style={[styles.badgeText, item.isPublished ? styles.badgeTextLive : styles.badgeTextDraft]}>
                        {item.isPublished ? "Published" : "Draft"}
                      </Text>
                    </View>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.license}</Text>
                    </View>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.price}>{priceLabel(item.price)}</Text>
                    <View style={styles.metaItem}>
                      <Ionicons name="bag-outline" size={12} color={C.muted} />
                      <Text style={styles.metaText}>{item.purchaseCount ?? 0}</Text>
                    </View>
                    {updatedLabel(item.updatedAt) ? <Text style={styles.metaText}>{updatedLabel(item.updatedAt)}</Text> : null}
                  </View>
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable
                  onPress={() => void openEditor(item)}
                  disabled={disabled}
                  style={[styles.actionButton, disabled && styles.buttonDisabled]}
                >
                  <Ionicons name="create-outline" size={14} color={C.accent} />
                  <Text style={styles.actionText}>Edit</Text>
                </Pressable>
                <Pressable
                  onPress={() => void togglePublished(item)}
                  disabled={disabled}
                  style={[styles.actionButton, disabled && styles.buttonDisabled]}
                >
                  <Ionicons
                    name={item.isPublished ? "eye-off-outline" : "eye-outline"}
                    size={14}
                    color={C.accent}
                  />
                  <Text style={styles.actionText}>{item.isPublished ? "Unpublish" : "Publish"}</Text>
                </Pressable>
                <Pressable
                  onPress={() => confirmDelete(item)}
                  disabled={disabled}
                  style={[styles.actionButton, styles.deleteButton, disabled && styles.buttonDisabled]}
                >
                  <Ionicons name="trash-outline" size={14} color={C.error} />
                  <Text style={[styles.actionText, { color: C.error }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <EditListingModal
        listing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
      />
    </View>
  );
}

function EditListingModal({
  listing,
  onClose,
  onSaved,
}: {
  listing: MyProduct | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [license, setLicense] = useState<License>("Personal");
  const [cover, setCover] = useState<PickedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!listing) return;
    setTitle(listing.title);
    setDescription(listing.description ?? "");
    setPrice((listing.price / 100).toFixed(2));
    setLicense(LICENSES.includes(listing.license as License) ? (listing.license as License) : "Personal");
    setCover(null);
    setNotice(null);
  }, [listing]);

  const pickCover = async () => {
    setNotice(null);
    try {
      const images = await pickImages("library", { max: 1, aspect: [4, 3] });
      if (images[0]) setCover(images[0]);
    } catch (e: any) {
      setNotice({ message: e?.message ?? "Could not open the image picker.", tone: "error" });
    }
  };

  const save = async () => {
    if (!listing || busy) return;
    setNotice(null);
    const trimmedTitle = title.trim();
    const cents = Math.round(Number(price) * 100);
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

    setBusy(true);
    try {
      const saved = await withVerification(async () => {
        const coverUrl = cover ? await uploadProductCover(cover) : (listing.coverUrl ?? null);
        return apiJson(`/api/v1/products/${encodeURIComponent(listing.id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: trimmedTitle,
            description: description.trim(),
            price: cents,
            license,
            coverUrl,
          }),
        });
      });
      if (saved === undefined) {
        setNotice({ message: "Claim your free WALLORA tick to save your listing.", tone: "info" });
        return;
      }
      onSaved();
    } catch (e: any) {
      setNotice({
        message: e?.status === 401 ? "Your session expired. Sign in again." : (e?.message ?? "Could not save changes."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const coverSource = cover?.uri ? { uri: cover.uri } : assetUrl(listing?.coverUrl) ? { uri: assetUrl(listing?.coverUrl) } : null;

  return (
    <Modal visible={!!listing} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <ScreenHeader
          title="Edit listing"
          subtitle={listing?.title ?? ""}
          showBack={false}
          right={
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
              <Ionicons name="close" size={18} color={C.text} />
            </Pressable>
          }
        />
        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <NoticeBanner notice={notice} />

          <Text style={styles.label}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            maxLength={120}
            editable={!busy}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            style={[styles.input, styles.textArea]}
            multiline
            maxLength={2000}
            editable={!busy}
          />

          <Text style={styles.label}>Price (USD)</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            style={styles.input}
            keyboardType="decimal-pad"
            editable={!busy}
          />

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
                <Ionicons name="image-outline" size={24} color={C.mutedDark} />
              )}
            </View>
            <View style={styles.coverActions}>
              <Pressable onPress={() => void pickCover()} disabled={busy} style={styles.secondaryButton}>
                <Ionicons name="cloud-upload-outline" size={16} color={C.accent} />
                <Text style={styles.secondaryButtonText}>Replace cover</Text>
              </Pressable>
              {cover ? (
                <Pressable onPress={() => setCover(null)} disabled={busy} hitSlop={8}>
                  <Text style={styles.removeText}>Restore original</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <Pressable onPress={onClose} disabled={busy} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => void save()}
            disabled={busy}
            style={[styles.primaryButton, styles.saveButton, busy && styles.buttonDisabled]}
          >
            {busy ? <ActivityIndicator color={C.bg} size="small" /> : <Text style={styles.primaryButtonText}>Save changes</Text>}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: S.lg, paddingBottom: S.xxxl },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: R.md,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { fontSize: 10, letterSpacing: 1.6, color: C.accent, fontWeight: "800", marginBottom: 4 },
  heading: { fontSize: 25, fontWeight: "800", color: C.text },
  lead: { fontSize: 12, color: C.muted, lineHeight: 18, marginTop: 5, marginBottom: S.lg },
  state: { alignItems: "center", paddingVertical: 48, gap: S.sm },
  stateText: { color: C.muted, fontSize: 12 },
  empty: { alignItems: "center", paddingVertical: 56, gap: S.sm },
  emptyTitle: { color: C.text, fontSize: 15, fontWeight: "800", textAlign: "center" },
  emptySub: { color: C.muted, fontSize: 12, textAlign: "center", lineHeight: 18, paddingHorizontal: S.xl },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: S.sm,
    borderWidth: 1,
    borderRadius: R.md,
    backgroundColor: C.card,
    padding: S.md,
    marginBottom: S.md,
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    padding: S.md,
    marginBottom: S.sm,
  },
  cardTop: { flexDirection: "row", gap: S.md },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: R.sm,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImage: { width: "100%", height: "100%" },
  cardInfo: { flex: 1, minWidth: 0 },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: "800" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.raised,
  },
  badgeLive: { borderColor: C.success + "55", backgroundColor: C.successDim },
  badgeDraft: { borderColor: C.border },
  badgeText: { color: C.muted, fontSize: 9, fontWeight: "800" },
  badgeTextLive: { color: C.success },
  badgeTextDraft: { color: C.muted },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: S.md, marginTop: 8 },
  price: { color: C.accent, fontSize: 13, fontWeight: "800" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { color: C.muted, fontSize: 11 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: S.sm, borderTopWidth: 1, borderTopColor: C.borderSoft, paddingTop: S.md, marginTop: S.md },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: S.md,
    paddingVertical: 8,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.raised,
  },
  actionText: { color: C.accent, fontSize: 12, fontWeight: "700" },
  deleteButton: { borderColor: C.error + "55", backgroundColor: C.errorDim },
  buttonDisabled: { opacity: 0.6 },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accent,
    borderRadius: R.md,
    paddingHorizontal: S.xl,
    paddingVertical: 11,
    marginTop: S.sm,
  },
  primaryButtonText: { color: C.bg, fontSize: 13, fontWeight: "800" },
  modalRoot: { flex: 1, backgroundColor: C.bg },
  modalContent: { padding: S.lg, paddingBottom: S.xxxl },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: R.md,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { color: C.text, fontSize: 12, fontWeight: "800", marginBottom: 7, marginTop: S.md },
  input: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: 11,
    color: C.text,
    fontSize: 14,
  },
  textArea: { minHeight: 90, textAlignVertical: "top", lineHeight: 20 },
  sectionGap: { marginTop: S.md },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: S.sm, marginTop: 2 },
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
  coverRow: { flexDirection: "row", gap: S.md, alignItems: "flex-start", marginTop: S.sm },
  coverPreview: {
    width: 96,
    height: 72,
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
  cancelButton: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: S.lg,
  },
  cancelText: { color: C.muted, fontSize: 13, fontWeight: "700" },
  saveButton: { marginTop: S.sm },
});
