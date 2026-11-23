import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { EmptyState } from "../../components/ui/States";
import { C, R, SHADOW } from "../../lib/theme";
import {
  badgeFor,
  clamp,
  DEMO_VIDEOS,
  loadVideoLibrary,
  loadVideoProgress,
  makeId,
  saveVideoLibrary,
  saveVideoProgress,
  sourceLabel,
  titleFromUri,
  type ProgressEntry,
  type VideoItem,
} from "../../lib/videoLibrary";

type Category = "all" | "imported" | "streams" | "continue" | "favorites";
type SortMode = "recent" | "added" | "title";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "imported", label: "Imported" },
  { key: "streams", label: "Streams" },
  { key: "continue", label: "Continue" },
  { key: "favorites", label: "Favorites" },
];

const FILL = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

function inProgress(item: VideoItem, progress: Record<string, ProgressEntry>) {
  const entry = progress[item.id];
  return (
    !!entry &&
    !entry.completed &&
    entry.position > 5 &&
    entry.duration > 0 &&
    entry.position < entry.duration - 3
  );
}

function formatPercent(item: VideoItem, progress: Record<string, ProgressEntry>) {
  const entry = progress[item.id];
  if (!entry || entry.duration <= 0) return 0;
  return clamp((entry.position / entry.duration) * 100, 0, 100);
}

export default function VideoLibraryScreen() {
  const router = useRouter();
  const [items, setItems] = useState<VideoItem[]>(DEMO_VIDEOS);
  const [progress, setProgress] = useState<Record<string, ProgressEntry>>({});
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [importOpen, setImportOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    Promise.all([loadVideoLibrary(), loadVideoProgress()])
      .then(([storedItems, storedProgress]) => {
        if (!alive) return;
        setItems(storedItems);
        setProgress(storedProgress);
      })
      .finally(() => {
        if (!alive) return;
        hydratedRef.current = true;
        setHydrated(true);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (hydrated) void saveVideoLibrary(items);
  }, [hydrated, items]);

  useEffect(() => {
    if (hydrated) void saveVideoProgress(progress);
  }, [hydrated, progress]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  const openItem = useCallback(
    (item: VideoItem) => {
      router.push({
        pathname: "/video-player/player",
        params: { id: item.id },
      });
    },
    [router],
  );

  const addItems = useCallback(
    (added: VideoItem[], message: string) => {
      setItems((current) => [...added, ...current]);
      setNotice(message);
      if (added[0]) openItem(added[0]);
    },
    [openItem],
  );

  const addUrl = () => {
    const uri = urlInput.trim();
    if (!/^https?:\/\//i.test(uri)) {
      setNotice("Enter a direct http(s) video or HLS link.");
      return;
    }
    addItems(
      [
        {
          id: makeId(uri),
          title: titleFromUri(uri, "Network stream"),
          uri,
          source: "url",
          addedAt: Date.now(),
        },
      ],
      "Stream added — opening player.",
    );
    setUrlInput("");
    setUrlOpen(false);
    setImportOpen(false);
  };

  const importFiles = async () => {
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "video/*",
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const added: VideoItem[] = result.assets.map((asset) => ({
        id: makeId(asset.uri),
        title: titleFromUri(asset.name ?? "", "Local video"),
        uri: asset.uri,
        source: "local",
        addedAt: Date.now(),
      }));
      addItems(added, `${added.length} video${added.length === 1 ? "" : "s"} imported.`);
      setImportOpen(false);
    } catch {
      setNotice("Could not import those files.");
    } finally {
      setImporting(false);
    }
  };

  const importFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setNotice("Gallery permission is needed to pick videos.");
        return;
      }
      setImporting(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
      });
      if (result.canceled || !result.assets?.length) return;
      const added: VideoItem[] = result.assets.map((asset) => ({
        id: makeId(asset.uri),
        title: titleFromUri(asset.fileName ?? "", "Gallery video"),
        uri: asset.uri,
        source: "local",
        addedAt: Date.now(),
      }));
      addItems(added, "Video imported from gallery.");
      setImportOpen(false);
    } catch {
      setNotice("Could not import that video.");
    } finally {
      setImporting(false);
    }
  };

  const toggleFavorite = (id: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, favorite: !item.favorite } : item,
      ),
    );
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setProgress((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setNotice("Removed from your library.");
  };

  const continueItems = useMemo(
    () =>
      items
        .filter((item) => inProgress(item, progress))
        .sort(
          (a, b) =>
            (progress[b.id]?.updatedAt ?? 0) - (progress[a.id]?.updatedAt ?? 0),
        ),
    [items, progress],
  );

  const heroItem = continueItems[0] ?? items[0] ?? null;
  const heroPercent = heroItem ? formatPercent(heroItem, progress) : 0;

  const visibleItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      const matchesCategory =
        category === "all" ||
        (category === "imported" && item.source === "local") ||
        (category === "streams" && item.source !== "local") ||
        (category === "continue" && inProgress(item, progress)) ||
        (category === "favorites" && !!item.favorite);
      const matchesSearch =
        !term ||
        item.title.toLowerCase().includes(term) ||
        item.uri.toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
    return filtered.sort((a, b) => {
      if (sortMode === "title")
        return a.title.localeCompare(b.title, undefined, {
          sensitivity: "base",
        });
      if (sortMode === "added") return b.addedAt - a.addedAt;
      return (
        (progress[b.id]?.updatedAt ?? b.addedAt) -
        (progress[a.id]?.updatedAt ?? a.addedAt)
      );
    });
  }, [category, items, progress, query, sortMode]);

  const renderCard = ({ item }: { item: VideoItem }) => {
    const percent = formatPercent(item, progress);
    return (
      <View style={styles.card}>
        <Pressable
          onPress={() => openItem(item)}
          style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
        >
          <View style={styles.thumb}>
            <LinearGradient
              colors={[C.raised, C.bgDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={FILL}
            />
            <Ionicons name="play" size={20} color={C.accentBright} />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeFor(item)}</Text>
            </View>
            {percent > 0 && (
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${percent}%` }]} />
              </View>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {sourceLabel(item)} · {percent > 0 ? `${Math.round(percent)}% watched` : "Ready to play"}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => toggleFavorite(item.id)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Toggle favorite"
        >
          <Ionicons
            name={item.favorite ? "heart" : "heart-outline"}
            size={17}
            color={item.favorite ? C.error : C.muted}
          />
        </Pressable>
        {item.source !== "demo" && (
          <Pressable
            onPress={() => removeItem(item.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Remove video"
          >
            <Ionicons name="close-outline" size={18} color={C.muted} />
          </Pressable>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="WALLORA Player"
        subtitle="Your library, streams and downloads"
        right={
          <Pressable
            onPress={() => router.push("/video-player/settings")}
            hitSlop={10}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Video player settings"
          >
            <Ionicons name="settings-outline" size={19} color={C.accent} />
          </Pressable>
        }
      />

      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={styles.list}
        initialNumToRender={12}
        ListHeaderComponent={
          <View>
            {heroItem && (
              <Pressable
                onPress={() => openItem(heroItem)}
                style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
              >
                <LinearGradient
                  colors={[C.raised, C.bgDeep, C.bgDeep]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={FILL}
                />
                <View style={styles.heroTop}>
                  <View style={styles.heroPill}>
                    <Ionicons name="play" size={11} color={C.bg} />
                    <Text style={styles.heroPillText}>
                      {heroPercent > 0 ? "CONTINUE" : "WATCH NOW"}
                    </Text>
                  </View>
                  <Text style={styles.heroBadge}>{badgeFor(heroItem)}</Text>
                </View>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {heroItem.title}
                </Text>
                <Text style={styles.heroSubtitle} numberOfLines={1}>
                  {sourceLabel(heroItem)}
                </Text>
                <View style={styles.heroProgressTrack}>
                  <View
                    style={[styles.heroProgressFill, { width: `${heroPercent}%` }]}
                  />
                </View>
                <View style={styles.heroFooter}>
                  <Text style={styles.heroFooterText}>
                    Open full-screen player · CC · quality · share
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color={C.accent} />
                </View>
              </Pressable>
            )}

            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={16} color={C.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search your library"
                placeholderTextColor={C.mutedDark}
                style={styles.searchInput}
              />
              <Pressable
                onPress={() => setImportOpen(true)}
                style={styles.addButton}
                hitSlop={8}
              >
                <Ionicons name="add" size={19} color={C.bg} />
              </Pressable>
            </View>

            <ScrollViewChips
              categories={CATEGORIES}
              value={category}
              onChange={setCategory}
            />

            <View style={styles.sortRow}>
              <Text style={styles.sortLabel}>Sort</Text>
              {(["recent", "added", "title"] as SortMode[]).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setSortMode(mode)}
                  style={[
                    styles.sortChip,
                    sortMode === mode && styles.sortChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.sortChipText,
                      sortMode === mode && styles.sortChipTextActive,
                    ]}
                  >
                    {mode === "recent" ? "Recent" : mode === "added" ? "Added" : "A–Z"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="film-outline"
            title="No videos here yet"
            message="Import a file, add a stream URL, or pick one of the demo streams."
            actionLabel="Add a video"
            onAction={() => setImportOpen(true)}
          />
        }
      />

      {notice && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{notice}</Text>
        </View>
      )}

      <Modal
        visible={importOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setImportOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setImportOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Add to WALLORA Player</Text>
          <Text style={styles.sheetSubtitle}>
            Open a local file, a gallery video or a network stream. Everything plays in the app.
          </Text>
          <Pressable onPress={() => void importFiles()} disabled={importing} style={styles.sheetButton}>
            {importing ? (
              <ActivityIndicator color={C.bg} />
            ) : (
              <Ionicons name="folder-outline" size={17} color={C.bg} />
            )}
            <Text style={styles.sheetButtonText}>Choose video files</Text>
          </Pressable>
          <Pressable onPress={() => void importFromGallery()} disabled={importing} style={styles.sheetButtonAlt}>
            <Ionicons name="images-outline" size={17} color={C.accent} />
            <Text style={styles.sheetButtonAltText}>Pick from gallery</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setImportOpen(false);
              setUrlOpen(true);
            }}
            style={styles.sheetButtonAlt}
          >
            <Ionicons name="link-outline" size={17} color={C.accent} />
            <Text style={styles.sheetButtonAltText}>Add stream URL</Text>
          </Pressable>
          <Pressable onPress={() => setImportOpen(false)} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal
        visible={urlOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setUrlOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setUrlOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Add a stream URL</Text>
          <Text style={styles.sheetSubtitle}>
            Direct MP4 or HLS (.m3u8) links work best.
          </Text>
          <TextInput
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="https://example.com/video.m3u8"
            placeholderTextColor={C.mutedDark}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.urlInput}
          />
          <Pressable onPress={addUrl} style={styles.sheetButton}>
            <Ionicons name="play" size={16} color={C.bg} />
            <Text style={styles.sheetButtonText}>Open stream</Text>
          </Pressable>
          <Pressable onPress={() => setUrlOpen(false)} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function ScrollViewChips({
  categories,
  value,
  onChange,
}: {
  categories: { key: Category; label: string }[];
  value: Category;
  onChange: (category: Category) => void;
}) {
  return (
    <View style={styles.categoryRow}>
      {categories.map((entry) => (
        <Pressable
          key={entry.key}
          onPress={() => onChange(entry.key)}
          style={[styles.categoryChip, value === entry.key && styles.categoryChipActive]}
        >
          <Text
            style={[
              styles.categoryChipText,
              value === entry.key && styles.categoryChipTextActive,
            ]}
          >
            {entry.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  list: { paddingBottom: 40 },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: R.md,
    backgroundColor: C.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    marginHorizontal: 16,
    marginTop: 14,
    minHeight: 190,
    padding: 16,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.borderSoft,
    ...SHADOW.card,
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: C.accent,
  },
  heroPillText: { color: C.bg, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  heroBadge: {
    color: C.textSoft,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: C.raised,
  },
  heroTitle: { color: C.white, fontSize: 21, fontWeight: "900", marginTop: 30, lineHeight: 26 },
  heroSubtitle: { color: C.textSoft, fontSize: 11.5, marginTop: 5 },
  heroProgressTrack: { height: 3, borderRadius: 2, backgroundColor: C.raisedHover, marginTop: 18 },
  heroProgressFill: { height: 3, borderRadius: 2, backgroundColor: C.accent },
  heroFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  heroFooterText: { color: C.textSoft, fontSize: 10.5, fontWeight: "700" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderSoft,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 13 },
  addButton: {
    width: 29,
    height: 29,
    borderRadius: R.sm,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryRow: { flexDirection: "row", gap: 7, paddingHorizontal: 16, marginTop: 12 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: R.pill,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderSoft,
  },
  categoryChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  categoryChipText: { color: C.textSoft, fontSize: 11, fontWeight: "800" },
  categoryChipTextActive: { color: C.bg },
  sortRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, marginTop: 14 },
  sortLabel: { color: C.muted, fontSize: 10, fontWeight: "800", marginRight: 3 },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.borderSoft,
  },
  sortChipActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  sortChipText: { color: C.muted, fontSize: 10, fontWeight: "700" },
  sortChipTextActive: { color: C.accent },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 9,
    padding: 10,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderSoft,
  },
  cardMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 11, minWidth: 0 },
  thumb: {
    position: "relative",
    width: 66,
    height: 46,
    borderRadius: R.sm,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: { position: "absolute", top: 4, left: 4, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 4, paddingVertical: 2 },
  badgeText: { color: C.white, fontSize: 7, fontWeight: "900", letterSpacing: 0.5 },
  progressTrack: { position: "absolute", left: 0, right: 0, bottom: 0, height: 2, backgroundColor: C.raisedHover },
  progressFill: { height: 2, backgroundColor: C.accent },
  cardTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  cardSubtitle: { color: C.muted, fontSize: 10.5, marginTop: 3 },
  pressed: { opacity: 0.7 },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    padding: 12,
    borderRadius: R.md,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
  },
  toastText: { color: C.text, fontSize: 12, textAlign: "center" },
  modalBackdrop: { ...FILL, backgroundColor: C.overlay },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    paddingBottom: 30,
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderSoft,
  },
  sheetTitle: { color: C.text, fontSize: 18, fontWeight: "900" },
  sheetSubtitle: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 16 },
  sheetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 46,
    borderRadius: R.md,
    backgroundColor: C.accent,
  },
  sheetButtonText: { color: C.bg, fontSize: 13, fontWeight: "900" },
  sheetButtonAlt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 44,
    marginTop: 9,
    borderRadius: R.md,
    backgroundColor: C.raised,
  },
  sheetButtonAltText: { color: C.text, fontSize: 12.5, fontWeight: "800" },
  urlInput: {
    minHeight: 46,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bgDeep,
    color: C.text,
    paddingHorizontal: 12,
    fontSize: 12,
    marginBottom: 12,
  },
  cancelButton: { alignItems: "center", paddingVertical: 14 },
  cancelText: { color: C.muted, fontSize: 12, fontWeight: "700" },
});
