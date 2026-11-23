import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEvent } from "expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useVideoPlayer,
  VideoView,
  type VideoSource,
} from "expo-video";

import { TvSignalSearching } from "../../components/media/TvSignalSearching";
import {
  getReelsApiKey,
  getReelsProvider,
  loadStockReels,
  setReelsApiKey,
  setReelsProvider,
  type ReelProvider,
  type StockReel,
} from "../../lib/reels";
import { C, R } from "../../lib/theme";

function countLabel(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}

function ReelCard({
  reel,
  active,
  liked,
  likeCount,
  onLike,
  onShare,
  onSettings,
  insetsTop,
  insetsBottom,
  viewportHeight,
}: {
  reel: StockReel;
  active: boolean;
  liked: boolean;
  likeCount: number;
  onLike: () => void;
  onShare: () => void;
  onSettings: () => void;
  insetsTop: number;
  insetsBottom: number;
  viewportHeight: number;
}) {
  const source = useMemo<VideoSource>(
    () => ({
      uri: reel.uri,
      contentType: "auto",
      metadata: { title: reel.title, artist: "WALLORA Reels" },
    }),
    [reel.title, reel.uri],
  );
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = true;
    instance.muted = false;
  });
  const { status } = useEvent(player, "statusChange", { status: player.status });
  const [heartVisible, setHeartVisible] = useState(false);
  const heartScale = useMemo(() => new Animated.Value(0), []);
  const lastTap = useRef(0);

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  const togglePlay = () => {
    if (player.playing) player.pause();
    else player.play();
  };

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      onLike();
      setHeartVisible(true);
      heartScale.setValue(0.4);
      Animated.sequence([
        Animated.timing(heartScale, { toValue: 1.25, duration: 180, useNativeDriver: true }),
        Animated.timing(heartScale, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start(() => setTimeout(() => setHeartVisible(false), 420));
    } else {
      lastTap.current = now;
      togglePlay();
    }
  };

  const buffering = status === "loading";

  return (
    <View style={[styles.reel, { height: viewportHeight }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={handleTap}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          surfaceType="textureView"
          nativeControls={false}
        />
      </Pressable>

      <View style={styles.topShade} pointerEvents="none" />
      <View style={styles.bottomShade} pointerEvents="none" />

      <View style={[styles.topBar, { paddingTop: insetsTop + 10 }]} pointerEvents="box-none">
        <View style={styles.brandPill}>
          <Ionicons name="tv-outline" size={13} color={C.accent} />
          <Text style={styles.brandText}>WALLORA REELS</Text>
        </View>
        <Pressable onPress={onSettings} style={styles.sourcePill}>
          <Ionicons
            name={reel.source === "sample" ? "flash-outline" : "checkmark-circle-outline"}
            size={11}
            color={C.accent}
          />
          <Text style={styles.sourcePillText}>
            {reel.source === "pexels"
              ? "PEXELS"
              : reel.source === "pixabay"
                ? "PIXABAY"
                : "SAMPLE"}
          </Text>
        </Pressable>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[styles.heartBurst, { opacity: heartVisible ? 1 : 0, transform: [{ scale: heartScale }] }]}
      >
        <Ionicons name="heart" size={86} color={C.accent} />
      </Animated.View>

      {buffering ? (
        <View style={styles.bufferWrap} pointerEvents="none">
          <TvSignalSearching label="LOADING REEL" detail="Preparing your vertical feed…" compact />
        </View>
      ) : null}

      <View style={[styles.bottom, { paddingBottom: insetsBottom + 16 }]} pointerEvents="box-none">
        <View style={styles.info}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={15} color={C.textSoft} />
            </View>
            <Text style={styles.author} numberOfLines={1}>
              {reel.creator}
            </Text>
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceBadgeText}>ROYALTY-FREE</Text>
            </View>
          </View>
          <Text style={styles.caption} numberOfLines={3}>
            {reel.title}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="information-circle-outline" size={11} color={C.muted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {reel.source === "sample"
                ? "Pexels sample · add a key for fresh clips"
                : `Via ${reel.source === "pexels" ? "Pexels" : "Pixabay"} API`}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable onPress={onLike} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
            <Ionicons name={liked ? "heart" : "heart-outline"} size={28} color={liked ? C.error : C.white} />
            <Text style={styles.actionCount}>{countLabel(likeCount)}</Text>
          </Pressable>
          <Pressable onPress={onShare} style={styles.action}>
            <Ionicons name="share-outline" size={26} color={C.white} />
            <Text style={styles.actionCount}>Share</Text>
          </Pressable>
          <Pressable onPress={onSettings} style={styles.action}>
            <Ionicons name="settings-outline" size={25} color={C.white} />
            <Text style={styles.actionCount}>Source</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function SourceSettings({
  visible,
  provider,
  apiKey,
  onProvider,
  onKey,
  onClose,
}: {
  visible: boolean;
  provider: ReelProvider;
  apiKey: string;
  onProvider: (value: ReelProvider) => void;
  onKey: (value: string) => void;
  onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <View style={styles.modalBackdrop}>
      <View style={styles.modalCard}>
        <View style={styles.modalHead}>
          <Text style={styles.modalTitle}>Reels source</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={20} color={C.textSoft} />
          </Pressable>
        </View>
        <Text style={styles.modalText}>
          Add a free API key to stream fresh 9:16 royalty-free clips. Without a key, WALLORA Reels
          plays verified Pexels samples.
        </Text>
        <View style={styles.providerRow}>
          {(["pexels", "pixabay"] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => onProvider(value)}
              style={[styles.providerChip, provider === value && styles.providerChipActive]}
            >
              <Text style={[styles.providerText, provider === value && styles.providerTextActive]}>
                {value === "pexels" ? "Pexels" : "Pixabay"}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={apiKey}
          onChangeText={onKey}
          placeholder={provider === "pexels" ? "Pexels API key" : "Pixabay API key"}
          placeholderTextColor={C.muted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={styles.keyInput}
        />
        <Text style={styles.modalHint}>
          {provider === "pexels"
            ? "Get a free key at pexels.com/api — look for portrait orientation."
            : "Get a free key at pixabay.com/api — WALLORA requests orientation=vertical."}
        </Text>
        <Pressable style={styles.modalButton} onPress={onClose}>
          <Text style={styles.modalButtonText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ReelsScreen() {
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const [reels, setReels] = useState<StockReel[]>([]);
  const [provider, setProviderState] = useState<ReelProvider>("pexels");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [settingsVisible, setSettingsVisible] = useState(false);

  const load = useCallback(async (nextProvider?: ReelProvider) => {
    setError(null);
    const selected = nextProvider ?? provider;
    try {
      const result = await loadStockReels({ provider: selected });
      setReels(result.reels);
      setError(result.error ?? null);
      setActiveIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load WALLORA Reels.");
      setReels([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [provider]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const savedProvider = await getReelsProvider();
      const savedKey = await getReelsApiKey(savedProvider);
      if (!alive) return;
      setProviderState(savedProvider);
      setApiKey(savedKey);
      const result = await loadStockReels({ provider: savedProvider });
      if (!alive) return;
      setReels(result.reels);
      setError(result.error ?? null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const changeProvider = useCallback(
    (value: ReelProvider) => {
      setProviderState(value);
      void (async () => {
        await setReelsProvider(value);
        const key = await getReelsApiKey(value);
        setApiKey(key);
        await load(value);
      })();
    },
    [load],
  );

  const changeKey = useCallback(
    (value: string) => {
      setApiKey(value);
      void (async () => {
        await setReelsApiKey(provider, value);
        await load(provider);
      })();
    },
    [load, provider],
  );

  const toggleLike = useCallback((id: string) => {
    const next = !liked[id];
    setLiked((prev) => ({ ...prev, [id]: next }));
    setLikes((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + (next ? 1 : -1)) }));
  }, [liked]);

  const share = useCallback(async (reel: StockReel) => {
    try {
      await Share.share({
        title: "WALLORA Reels",
        message: `${reel.title} — ${reel.creator}`,
        url: reel.creditUrl ?? reel.uri,
      });
    } catch {
      // The share sheet can be dismissed safely.
    }
  }, []);

  const viewConfig = useMemo(() => ({ itemVisiblePercentThreshold: 70 }), []);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <TvSignalSearching label="OPENING WALLORA REELS" detail="Preparing your vertical feed…" compact />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={reels}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        onViewableItemsChanged={({ viewableItems }) => {
          const first = viewableItems[0];
          if (first?.index != null) setActiveIndex(first.index);
        }}
        viewabilityConfig={viewConfig}
        renderItem={({ item, index }) => (
          <ReelCard
            reel={item}
            active={index === activeIndex}
            liked={!!liked[item.id]}
            likeCount={likes[item.id] ?? 0}
            onLike={() => toggleLike(item.id)}
            onShare={() => void share(item)}
            onSettings={() => setSettingsVisible(true)}
            insetsTop={insets.top}
            insetsBottom={insets.bottom}
            viewportHeight={viewportHeight}
          />
        )}
        ListEmptyComponent={
          <View style={[styles.empty, { height: viewportHeight }]}>
            <Ionicons name="videocam-outline" size={44} color={C.muted} />
            <Text style={styles.emptyTitle}>No reels available</Text>
            <Text style={styles.emptyText}>
              {error ?? "Add a free Pexels or Pixabay key to load vertical clips."}
            </Text>
            <View style={styles.emptyActions}>
              <Pressable style={styles.emptyButton} onPress={() => setSettingsVisible(true)}>
                <Text style={styles.emptyButtonText}>Set source</Text>
              </Pressable>
              <Pressable style={styles.emptyButtonGhost} onPress={onRefresh}>
                <Text style={styles.emptyButtonGhostText}>Refresh</Text>
              </Pressable>
              <Pressable style={styles.emptyButtonGhost} onPress={() => router.back()}>
                <Text style={styles.emptyButtonGhostText}>Back</Text>
              </Pressable>
            </View>
          </View>
        }
      />
      <SourceSettings
        visible={settingsVisible}
        provider={provider}
        apiKey={apiKey}
        onProvider={changeProvider}
        onKey={changeKey}
        onClose={() => setSettingsVisible(false)}
      />
      {refreshing && reels.length === 0 ? <ActivityIndicator color={C.accent} style={styles.refreshing} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bgDeep },
  center: { alignItems: "center", justifyContent: "center" },
  reel: { width: "100%", backgroundColor: C.bgDeep, overflow: "hidden" },
  topShade: { position: "absolute", top: 0, left: 0, right: 0, height: 150, backgroundColor: "rgba(0,0,0,0.45)" },
  bottomShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 300, backgroundColor: "rgba(0,0,0,0.55)" },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  brandPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.pill, backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  brandText: { color: C.accentBright, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  sourcePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.pill, backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  sourcePillText: { color: C.white, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  heartBurst: { position: "absolute", alignSelf: "center", top: "42%", shadowColor: "#000", shadowRadius: 16, shadowOpacity: 0.5 },
  bufferWrap: { position: "absolute", alignSelf: "center", top: "38%" },
  bottom: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, gap: 12 },
  info: { flex: 1, minWidth: 0 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.raised, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" },
  author: { color: C.white, fontSize: 13, fontWeight: "800", flexShrink: 1 },
  sourceBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accent + "66" },
  sourceBadgeText: { color: C.accentBright, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  caption: { color: C.white, fontSize: 13, lineHeight: 19, textShadowColor: "#000", textShadowRadius: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  metaText: { color: C.textSoft, fontSize: 10, flexShrink: 1 },
  actions: { alignItems: "center", gap: 16 },
  action: { alignItems: "center", width: 44 },
  actionPressed: { opacity: 0.6 },
  actionCount: { color: C.white, fontSize: 10, fontWeight: "700", marginTop: 3 },
  empty: { width: "100%", alignItems: "center", justifyContent: "center", paddingHorizontal: 30, gap: 8 },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: "800", marginTop: 10 },
  emptyText: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  emptyActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 14 },
  emptyButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: R.md, backgroundColor: C.accent },
  emptyButtonText: { color: C.bg, fontSize: 12, fontWeight: "800" },
  emptyButtonGhost: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: R.md, borderWidth: 1, borderColor: C.border },
  emptyButtonGhostText: { color: C.textSoft, fontSize: 12, fontWeight: "700" },
  modalBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { width: "100%", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, padding: 18 },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  modalTitle: { color: C.text, fontSize: 17, fontWeight: "800" },
  modalText: { color: C.textSoft, fontSize: 12, lineHeight: 18 },
  providerRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  providerChip: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: R.md, borderWidth: 1, borderColor: C.border, backgroundColor: C.raised },
  providerChipActive: { backgroundColor: C.accentDim, borderColor: C.accent + "88" },
  providerText: { color: C.textSoft, fontSize: 12, fontWeight: "700" },
  providerTextActive: { color: C.accentBright },
  keyInput: { marginTop: 12, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10, color: C.text, fontSize: 13 },
  modalHint: { color: C.muted, fontSize: 10.5, lineHeight: 15, marginTop: 8 },
  modalButton: { marginTop: 16, backgroundColor: C.accent, borderRadius: R.md, paddingVertical: 12, alignItems: "center" },
  modalButtonText: { color: C.bg, fontSize: 13, fontWeight: "800" },
  refreshing: { position: "absolute", top: 20 },
});
