import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { File } from "expo-file-system";

import { C, R, SHADOW } from "../lib/theme";
import { ScreenHeader } from "../components/ui/ScreenHeader";
import { Notice } from "../components/ui/Notice";
import {
  DownloadedWallpaper,
  addAsWallpaper,
  readDownloads,
  removeDownload,
} from "../lib/downloads";

function formatBytes(bytes?: number) {
  if (!bytes) return "Local copy";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DownloadsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<DownloadedWallpaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<DownloadedWallpaper | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const downloads = await readDownloads();
    setItems(downloads);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  useEffect(() => {
    if (!selected) return;
    const stillThere = items.find((item) => item.id === selected.id);
    if (!stillThere) setSelected(null);
  }, [items, selected]);

  const onRemove = async (item: DownloadedWallpaper) => {
    await removeDownload(item.id);
    setSelected(null);
    await load();
    setNotice("Removed from WALLORA Downloads");
  };

  const onAddAsWallpaper = async (item: DownloadedWallpaper) => {
    setBusy(true);
    try {
      await addAsWallpaper(item);
      const file = new File(item.localUri);
      if (await File.canPreview(file)) {
        await File.preview(file, { title: item.title, mimeType: "image/jpeg" });
      }
      setNotice("Saved to WALLORA album. Use your device preview to set it as wallpaper.");
    } catch (e: any) {
      setNotice(e?.message ?? "Could not add as wallpaper");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Notice message={notice} onDismiss={() => setNotice(null)} />
      <ScreenHeader
        title="WALLORA Downloads"
        subtitle={`${items.length} wallpaper${items.length === 1 ? "" : "s"} saved offline`}
        right={
          <Pressable onPress={() => router.push("/(tabs)/discover")} hitSlop={10} style={styles.headerAction}>
            <Ionicons name="compass-outline" size={18} color={C.accent} />
          </Pressable>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={C.accent}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]}
      >
        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Ionicons name="download-outline" size={20} color={C.bg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Your offline collection</Text>
            <Text style={styles.infoText}>
              Downloads stay on this device. Preview any wallpaper, then save it to the WALLORA gallery album and apply it from your device.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={C.accent} size="large" />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyOrb}>
              <Ionicons name="download-outline" size={30} color={C.accent} />
            </View>
            <Text style={styles.emptyTitle}>No downloads yet</Text>
            <Text style={styles.emptyText}>
              Download any wallpaper from Discover or your AI Studio generations and it will appear here.
            </Text>
            <Pressable onPress={() => router.push("/(tabs)/discover")} style={styles.emptyCta}>
              <Ionicons name="compass-outline" size={16} color={C.bg} />
              <Text style={styles.emptyCtaText}>Explore wallpapers</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.grid}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setSelected(item)}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <Image source={{ uri: item.localUri }} style={styles.thumb} resizeMode="cover" />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {item.creator ?? "WALLORA"}
                  </Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardSize}>{formatBytes(item.bytes)}</Text>
                    <Ionicons name="chevron-forward" size={15} color={C.muted} />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalEyebrow}>WALLORA DOWNLOAD</Text>
                <Pressable onPress={() => setSelected(null)} hitSlop={10}>
                  <Ionicons name="close" size={22} color={C.text} />
                </Pressable>
              </View>
              <Image source={{ uri: selected.localUri }} style={styles.previewImage} resizeMode="contain" />
              <Text style={styles.modalTitle} numberOfLines={2}>
                {selected.title}
              </Text>
              <Text style={styles.modalMeta}>
                {selected.creator ? `by ${selected.creator} · ` : ""}
                {selected.width && selected.height ? `${selected.width}x${selected.height} · ` : ""}
                {formatBytes(selected.bytes)}
              </Text>
              <Pressable
                onPress={() => onAddAsWallpaper(selected)}
                disabled={busy}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              >
                {busy ? (
                  <ActivityIndicator color={C.bg} size="small" />
                ) : (
                  <Ionicons name="image-outline" size={17} color={C.bg} />
                )}
                <Text style={styles.primaryBtnText}>Add as wallpaper</Text>
              </Pressable>
              {selected.slug && (
                <Pressable
                  onPress={() => {
                    const slug = selected.slug!;
                    setSelected(null);
                    router.push({ pathname: "/wallpaper/[slug]", params: { slug } });
                  }}
                  style={styles.secondaryBtn}
                >
                  <Ionicons name="open-outline" size={16} color={C.text} />
                  <Text style={styles.secondaryBtnText}>Open on WALLORA</Text>
                </Pressable>
              )}
              <Pressable onPress={() => onRemove(selected)} style={styles.removeBtn}>
                <Ionicons name="trash-outline" size={16} color={C.error} />
                <Text style={styles.removeBtnText}>Remove download</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  headerAction: { width: 38, height: 38, borderRadius: R.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  content: { padding: 16 },
  infoCard: { flexDirection: "row", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, padding: 14, marginBottom: 18 },
  infoIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  infoTitle: { color: C.text, fontSize: 14, fontWeight: "800" },
  infoText: { color: C.muted, fontSize: 11.5, lineHeight: 17, marginTop: 4 },
  loading: { paddingVertical: 60, alignItems: "center" },
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 },
  emptyOrb: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { color: C.text, fontSize: 17, fontWeight: "800" },
  emptyText: { color: C.muted, fontSize: 12.5, lineHeight: 19, textAlign: "center", marginTop: 7 },
  emptyCta: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.accent, borderRadius: R.pill, paddingHorizontal: 18, paddingVertical: 11, marginTop: 20 },
  emptyCtaText: { color: C.bg, fontWeight: "800", fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "47%", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, overflow: "hidden" },
  thumb: { width: "100%", height: 190, backgroundColor: C.raised },
  cardBody: { padding: 10 },
  cardTitle: { color: C.text, fontSize: 13, fontWeight: "700" },
  cardMeta: { color: C.muted, fontSize: 10.5, marginTop: 3 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  cardSize: { color: C.accent, fontSize: 10, fontWeight: "700" },
  pressed: { opacity: 0.75 },
  modalBackdrop: { flex: 1, backgroundColor: C.overlay, alignItems: "center", justifyContent: "center", padding: 18 },
  modalCard: { width: "100%", maxWidth: 420, backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border, borderRadius: R.xl, padding: 18, ...SHADOW.hero },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  modalEyebrow: { color: C.accent, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  previewImage: { width: "100%", height: 320, borderRadius: R.md, backgroundColor: C.bgDeep },
  modalTitle: { color: C.text, fontSize: 17, fontWeight: "800", marginTop: 14 },
  modalMeta: { color: C.muted, fontSize: 11.5, marginTop: 4 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.accent, borderRadius: R.md, paddingVertical: 13, marginTop: 18 },
  primaryBtnText: { color: C.bg, fontWeight: "800", fontSize: 14 },
  secondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: R.md, borderWidth: 1, borderColor: C.border, paddingVertical: 12, marginTop: 9 },
  secondaryBtnText: { color: C.text, fontWeight: "700", fontSize: 13 },
  removeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, marginTop: 6 },
  removeBtnText: { color: C.error, fontSize: 12, fontWeight: "700" },
});
