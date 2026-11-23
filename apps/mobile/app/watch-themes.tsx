import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { File } from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { apiJson } from "../lib/api";
import { assetUrl } from "../lib/config";
import { addAsWallpaper, downloadWallpaper } from "../lib/downloads";
import { C, R, SHADOW } from "../lib/theme";
import { ScreenHeader } from "../components/ui/ScreenHeader";

type Theme = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  dominantColor?: string | null;
  category?: { name?: string } | null;
  creator?: { displayName?: string | null; username?: string | null } | null;
  asset?: { objectKey: string; width: number; height: number } | null;
};

type Shape = "square" | "round";

/** Watch catalog uses WALLORA's real square collection, rendered as square and round faces. */
export default function WatchThemesScreen() {
  const insets = useSafeAreaInsets();
  const fade = useMemo(() => new Animated.Value(0), []);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Theme | null>(null);
  const [shape, setShape] = useState<Shape>("round");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiJson<{ items: Theme[] }>(
        "/api/v1/wallpapers?orientation=square&sort=popular&limit=24",
      );
      setThemes(data.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Could not load watch themes.");
      setThemes([]);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
    Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [fade, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const saveTheme = async (theme: Theme) => {
    const remoteUrl = assetUrl(theme.asset?.objectKey);
    if (!remoteUrl) {
      setNotice("This theme has no downloadable image yet.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const item = await downloadWallpaper({
        id: theme.id,
        title: `Watch · ${theme.title}`,
        remoteUrl,
        slug: theme.slug,
        creator: theme.creator?.displayName ?? theme.creator?.username ?? undefined,
        width: theme.asset?.width,
        height: theme.asset?.height,
      });
      await addAsWallpaper(item);
      const file = new File(item.localUri);
      if (await File.canPreview(file)) {
        await File.preview(file, { title: item.title, mimeType: "image/jpeg" });
      }
      setNotice("Saved to your WALLORA album. Choose it in your watch face gallery.");
    } catch (e: any) {
      setNotice(e?.message ?? "Could not save this watch theme.");
    } finally {
      setBusy(false);
    }
  };

  const heroImage = themes[0] ? assetUrl(themes[0].asset?.objectKey) : undefined;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Watch Themes"
        subtitle="Square art for round and square screens"
      />

      <Animated.ScrollView
        style={{ opacity: fade }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
        }
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        <View style={styles.hero}>
          {heroImage ? (
            <Image source={{ uri: heroImage }} style={styles.heroArt} resizeMode="cover" />
          ) : null}
          <View style={styles.heroShade} />
          <View style={styles.heroCopy}>
            <View style={styles.heroBadge}>
              <Ionicons name="watch-outline" size={13} color={C.accent} />
              <Text style={styles.heroBadgeText}>WALLORA WATCH</Text>
            </View>
            <Text style={styles.heroTitle}>Your wrist, your aesthetic.</Text>
            <Text style={styles.heroText}>
              Curated square compositions previewed as both round and square faces. Save a theme to
              the WALLORA album, then pick it in your watch face gallery.
            </Text>
          </View>
        </View>

        <View style={styles.guideCard}>
          <View style={styles.guideIcon}>
            <Ionicons name="information-circle-outline" size={18} color={C.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.guideTitle}>How to apply a watch theme</Text>
            <Text style={styles.guideText}>
              1. Save the theme to your WALLORA album. {"\n"}
              2. Open your watch companion app or watch face gallery. {"\n"}
              3. Choose Custom image → WALLORA → this theme.
            </Text>
          </View>
        </View>

        {notice ? (
          <View style={styles.notice}>
            <Ionicons name="checkmark-circle-outline" size={16} color={C.success} />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={[styles.notice, { borderColor: C.error + "55" }]}>
            <Ionicons name="alert-circle-outline" size={16} color={C.error} />
            <Text style={[styles.noticeText, { color: C.error }]}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Theme catalog</Text>
          <Text style={styles.sectionMeta}>{themes.length} square visuals</Text>
        </View>

        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator color={C.accent} size="large" />
            <Text style={styles.stateText}>Curating watch themes…</Text>
          </View>
        ) : themes.length === 0 ? (
          <View style={styles.state}>
            <Ionicons name="watch-outline" size={40} color={C.muted} />
            <Text style={styles.stateText}>No square themes yet</Text>
            <Text style={styles.stateSub}>Upload a square wallpaper on WALLORA and it will appear here.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {themes.map((theme) => {
              const uri = assetUrl(theme.asset?.objectKey);
              return (
                <Pressable
                  key={theme.id}
                  onPress={() => {
                    setSelected(theme);
                    setShape("round");
                    setNotice(null);
                  }}
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                >
                  <View style={styles.previewRow}>
                    <View style={styles.previewSquare}>
                      {uri ? <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" /> : null}
                    </View>
                    <View style={styles.previewRound}>
                      {uri ? <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" /> : null}
                    </View>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={1}>{theme.title}</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {theme.category?.name ?? "WALLORA curated"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Animated.ScrollView>

      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setSelected(null);
        }}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable style={styles.sheetDismiss} onPress={() => setSelected(null)} disabled={busy} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.sheetTitle} numberOfLines={1}>{selected?.title}</Text>
                <Text style={styles.sheetSubtitle} numberOfLines={1}>
                  {selected?.creator?.displayName ?? selected?.creator?.username ?? "WALLORA"}
                </Text>
              </View>
              <Pressable onPress={() => setSelected(null)} hitSlop={10} disabled={busy}>
                <Ionicons name="close" size={20} color={C.muted} />
              </Pressable>
            </View>

            <View style={styles.shapeRow}>
              <Pressable
                onPress={() => setShape("round")}
                style={[styles.shapeChip, shape === "round" && styles.shapeChipActive]}
              >
                <Ionicons name="ellipse-outline" size={15} color={shape === "round" ? C.bg : C.muted} />
                <Text style={[styles.shapeText, shape === "round" && styles.shapeTextActive]}>Round</Text>
              </Pressable>
              <Pressable
                onPress={() => setShape("square")}
                style={[styles.shapeChip, shape === "square" && styles.shapeChipActive]}
              >
                <Ionicons name="square-outline" size={15} color={shape === "square" ? C.bg : C.muted} />
                <Text style={[styles.shapeText, shape === "square" && styles.shapeTextActive]}>Square</Text>
              </Pressable>
            </View>

            <View style={styles.largePreviewWrap}>
              <View style={[styles.watchFrame, shape === "round" ? styles.watchRound : styles.watchSquare]}>
                {selected && assetUrl(selected.asset?.objectKey) ? (
                  <Image
                    source={{ uri: assetUrl(selected.asset?.objectKey) }}
                    style={styles.watchImage}
                    resizeMode="cover"
                  />
                ) : null}
                <View style={styles.watchTimeWrap}>
                  <Text style={styles.watchTime}>10:09</Text>
                </View>
              </View>
            </View>

            {selected?.description ? (
              <Text style={styles.sheetDescription} numberOfLines={3}>{selected.description}</Text>
            ) : null}

            <Pressable
              onPress={() => selected && void saveTheme(selected)}
              disabled={busy}
              style={[styles.saveButton, busy && styles.pressed]}
            >
              {busy ? (
                <ActivityIndicator color={C.bg} size="small" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={17} color={C.bg} />
                  <Text style={styles.saveButtonText}>Save to WALLORA album</Text>
                </>
              )}
            </Pressable>
            <Text style={styles.sheetNote}>
              WALLORA cannot set a watch face directly. Your watch gallery or companion app chooses the
              final placement.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16 },
  hero: { height: 220, borderRadius: R.xl, overflow: "hidden", backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  heroArt: { position: "absolute", width: "100%", height: "100%" },
  heroShade: { position: "absolute", inset: 0, backgroundColor: "rgba(7,8,10,0.58)" },
  heroCopy: { flex: 1, justifyContent: "flex-end", padding: 18 },
  heroBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accent + "55", borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 10 },
  heroBadgeText: { color: C.accent, fontSize: 9.5, fontWeight: "800", letterSpacing: 1.2 },
  heroTitle: { color: C.text, fontSize: 24, fontWeight: "800" },
  heroText: { color: C.textSoft, fontSize: 12, lineHeight: 18, marginTop: 7, maxWidth: 340 },
  guideCard: { flexDirection: "row", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, padding: 14, marginTop: 14 },
  guideIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center" },
  guideTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  guideText: { color: C.muted, fontSize: 11, lineHeight: 18, marginTop: 6 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: C.successDim, borderWidth: 1, borderColor: C.success + "44", borderRadius: R.md, padding: 11, marginTop: 12 },
  noticeText: { color: C.success, fontSize: 11.5, lineHeight: 17, flex: 1 },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 24, marginBottom: 13 },
  sectionTitle: { color: C.text, fontSize: 17, fontWeight: "800" },
  sectionMeta: { color: C.muted, fontSize: 11 },
  state: { alignItems: "center", justifyContent: "center", paddingVertical: 70, gap: 10 },
  stateText: { color: C.text, fontSize: 14, fontWeight: "700" },
  stateSub: { color: C.muted, fontSize: 11.5, textAlign: "center", paddingHorizontal: 40, lineHeight: 17 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "47%", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, padding: 12 },
  previewRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, height: 100, marginBottom: 12 },
  previewSquare: { width: 82, height: 82, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: C.border, backgroundColor: C.raised },
  previewRound: { width: 82, height: 82, borderRadius: 41, overflow: "hidden", borderWidth: 3, borderColor: C.raisedHover, backgroundColor: C.raised },
  previewImage: { width: "100%", height: "100%" },
  cardTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  cardMeta: { color: C.muted, fontSize: 10.5, marginTop: 3 },
  pressed: { opacity: 0.7 },
  sheetBackdrop: { flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" },
  sheetDismiss: { flex: 1 },
  sheet: { backgroundColor: C.bgElevated, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, borderTopWidth: 1, borderColor: C.border, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28, ...SHADOW.hero },
  sheetHandle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: C.raisedHover, marginBottom: 14 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetTitle: { color: C.text, fontSize: 18, fontWeight: "800" },
  sheetSubtitle: { color: C.muted, fontSize: 11.5, marginTop: 3 },
  shapeRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  shapeChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 13, paddingVertical: 8, borderRadius: R.pill, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border },
  shapeChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  shapeText: { color: C.muted, fontSize: 12, fontWeight: "700" },
  shapeTextActive: { color: C.bg },
  largePreviewWrap: { alignItems: "center", justifyContent: "center", height: 220, marginTop: 16 },
  watchFrame: { width: 186, height: 186, overflow: "hidden", borderWidth: 7, borderColor: C.raisedHover, backgroundColor: C.card, ...SHADOW.hero },
  watchRound: { borderRadius: 93 },
  watchSquare: { borderRadius: 34 },
  watchImage: { position: "absolute", width: "100%", height: "100%" },
  watchTimeWrap: { position: "absolute", left: 0, right: 0, top: 54, alignItems: "center" },
  watchTime: { color: C.white, fontSize: 32, fontWeight: "300", letterSpacing: 1, textShadowColor: "rgba(0,0,0,0.7)", textShadowRadius: 6 },
  sheetDescription: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 12 },
  saveButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.accent, borderRadius: R.md, paddingVertical: 13, marginTop: 18 },
  saveButtonText: { color: C.bg, fontSize: 13, fontWeight: "800" },
  sheetNote: { color: C.mutedDark, fontSize: 10.5, lineHeight: 16, textAlign: "center", marginTop: 10 },
});
