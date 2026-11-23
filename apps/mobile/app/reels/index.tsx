import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Pressable,
  ScrollView,
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
import { useVideoPlayer, VideoView, type VideoSource } from "expo-video";
import { WebView } from "react-native-webview";

import { TvSignalSearching } from "../../components/media/TvSignalSearching";
import {
  DEFAULT_REEL_INTERESTS,
  getReelInterests,
  getReelsApiKey,
  getReelsProvider,
  loadPersonalizedReels,
  loadStockReels,
  recordReelLike,
  setReelInterests,
  setReelsApiKey,
  setReelsProvider,
  type ReelProvider,
  type StockReel,
} from "../../lib/reels";
import { API_BASE } from "../../lib/config";
import { C, R } from "../../lib/theme";

type Tab = "foryou" | "search" | "topics";

/**
 * YouTube requires embedded players to identify the embedding site through a
 * valid HTTPS Referer/origin. A WebView that navigates straight to
 * youtube.com/embed/... has no web origin, so YouTube shows
 * "Error 153 - Video player configuration error".
 *
 * Wrapping the player in local HTML with an HTTPS baseUrl gives the document a
 * real origin (and therefore a valid Referer). API_BASE is our deployed HTTPS
 * site, so the identity we send matches WALLORA.
 */
const YOUTUBE_EMBED_ORIGIN = API_BASE.startsWith("https://")
  ? API_BASE.replace(/\/+$/, "")
  : "https://wallora-inky.vercel.app";

function buildYouTubeEmbedHtml(embedUrl: string) {
  const safeUrl = embedUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<!DOCTYPE html><html><head><meta name="referrer" content="strict-origin-when-cross-origin"><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"><style>html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden}iframe{display:block;width:100%;height:100%;border:0}</style></head><body><iframe src="${safeUrl}" title="WALLORA reel" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen playsinline></iframe></body></html>`;
}

function countLabel(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}

function sourceLabel(source: StockReel["source"]) {
  if (source === "youtube") return "YOUTUBE";
  if (source === "pixabay") return "PIXABAY";
  if (source === "pexels") return "PEXELS";
  return "SAMPLE";
}

function ReelCard({
  reel,
  active,
  liked,
  likeCount,
  onLike,
  onShare,
  insetsBottom,
  viewportHeight,
}: {
  reel: StockReel;
  active: boolean;
  liked: boolean;
  likeCount: number;
  onLike: () => void;
  onShare: () => void;
  insetsBottom: number;
  viewportHeight: number;
}) {
  const isYouTube = reel.source === "youtube";
  const videoSource = useMemo<VideoSource>(
    () => ({
      uri: reel.uri,
      contentType: "auto",
      metadata: { title: reel.title, artist: "WALLORA Reels" },
    }),
    [reel.title, reel.uri],
  );
  const player = useVideoPlayer(videoSource, (instance) => {
    instance.loop = true;
    instance.muted = false;
  });
  const { status } = useEvent(player, "statusChange", { status: player.status });
  const [heartVisible, setHeartVisible] = useState(false);
  const heartScale = useMemo(() => new Animated.Value(0), []);
  const lastTap = useRef(0);

  useEffect(() => {
    if (isYouTube) return;
    if (active) player.play();
    else player.pause();
  }, [active, isYouTube, player]);

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
    } else if (!isYouTube) {
      lastTap.current = now;
      togglePlay();
    }
  };

  const buffering = !isYouTube && status === "loading";
  const embedUrl = isYouTube
    ? `${reel.uri}?autoplay=${active ? 1 : 0}&loop=1&playlist=${reel.videoId}&controls=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(YOUTUBE_EMBED_ORIGIN)}`
    : "";
  const embedHtml = useMemo(
    () => (isYouTube ? buildYouTubeEmbedHtml(embedUrl) : ""),
    [embedUrl, isYouTube],
  );

  return (
    <View style={[styles.reel, { height: viewportHeight }]}>
      {isYouTube ? (
        <WebView
          source={{ html: embedHtml, baseUrl: YOUTUBE_EMBED_ORIGIN }}
          style={StyleSheet.absoluteFill}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          // The paged FlatList owns vertical gestures. Without this, YouTube's
          // page eats the swipe and the next reel only scrolls halfway.
          scrollEnabled={false}
          bounces={false}
        />
      ) : (
        <Pressable style={StyleSheet.absoluteFill} onPress={handleTap}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            surfaceType="textureView"
            nativeControls={false}
          />
        </Pressable>
      )}

      <View style={styles.topShade} pointerEvents="none" />
      <View style={styles.bottomShade} pointerEvents="none" />

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

      <View style={[styles.bottom, { paddingBottom: insetsBottom + 18, paddingRight: 78 }]} pointerEvents="box-none">
        <View style={styles.info}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={15} color={C.textSoft} />
            </View>
            <Text style={styles.author} numberOfLines={1}>
              {reel.creator}
            </Text>
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceBadgeText}>{sourceLabel(reel.source)}</Text>
            </View>
          </View>
          <Text style={styles.caption} numberOfLines={3}>
            {reel.title}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="information-circle-outline" size={11} color={C.muted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {isYouTube
                ? `YouTube Short · ${reel.durationSec ? `${reel.durationSec}s` : "short"}`
                : reel.source === "sample"
                  ? "Pexels sample · add a key for fresh clips"
                  : `Via ${reel.source === "pexels" ? "Pexels" : "Pixabay"} API`}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.actionRail, { bottom: insetsBottom + 92 }]} pointerEvents="box-none">
        <Pressable
          onPress={onLike}
          hitSlop={6}
          style={({ pressed }) => [styles.railButton, pressed && styles.railButtonPressed]}
        >
          <Ionicons name={liked ? "heart" : "heart-outline"} size={25} color={liked ? C.error : C.white} />
        </Pressable>
        <Text style={styles.railCount}>{countLabel(likeCount)}</Text>
        <Pressable
          onPress={onShare}
          hitSlop={6}
          style={({ pressed }) => [styles.railButton, pressed && styles.railButtonPressed]}
        >
          <Ionicons name="share-outline" size={23} color={C.white} />
        </Pressable>
        <Text style={styles.railCount}>Share</Text>
      </View>
    </View>
  );
}

function InterestPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View style={styles.interestGrid}>
      {DEFAULT_REEL_INTERESTS.map((interest) => {
        const active = selected.includes(interest);
        return (
          <Pressable
            key={interest}
            onPress={() => onToggle(interest)}
            style={[styles.interestChip, active && styles.interestChipActive]}
          >
            <Ionicons
              name={active ? "checkmark-circle" : "add-circle-outline"}
              size={14}
              color={active ? C.bg : C.accent}
            />
            <Text style={[styles.interestText, active && styles.interestTextActive]}>
              {interest.replace(" shorts", "")}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ModalShell({
  visible,
  title,
  children,
  onClose,
}: {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <View style={styles.modalBackdrop}>
      <View style={styles.modalCard}>
        <View style={styles.modalHead}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={20} color={C.textSoft} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
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
  return (
    <ModalShell visible={visible} title="Reels source" onClose={onClose}>
      <Text style={styles.modalText}>
        YouTube powers your personal For You feed. Pixabay and Pexels provide royalty-free stock
        clips. Keys are stored on this device.
      </Text>
      <View style={styles.providerRow}>
        {(["youtube", "pixabay", "pexels"] as const).map((value) => (
          <Pressable
            key={value}
            onPress={() => onProvider(value)}
            style={[styles.providerChip, provider === value && styles.providerChipActive]}
          >
            <Text style={[styles.providerText, provider === value && styles.providerTextActive]}>
              {value === "youtube" ? "YouTube" : value === "pixabay" ? "Pixabay" : "Pexels"}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={apiKey}
        onChangeText={onKey}
        placeholder={
          provider === "youtube"
            ? "YouTube Data API key"
            : provider === "pexels"
              ? "Pexels API key"
              : "Pixabay API key"
        }
        placeholderTextColor={C.muted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        style={styles.keyInput}
      />
      <Text style={styles.modalHint}>
        {provider === "youtube"
          ? "Uses short YouTube videos matched to your interests. Leave blank to use the local key."
          : provider === "pexels"
            ? "Get a free key at pexels.com/api — look for portrait orientation."
            : "Get a free key at pixabay.com/api — WALLORA requests orientation=vertical."}
      </Text>
      <Pressable style={styles.modalButton} onPress={onClose}>
        <Text style={styles.modalButtonText}>Done</Text>
      </Pressable>
    </ModalShell>
  );
}

export default function ReelsScreen() {
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>("foryou");
  const [source, setSource] = useState<ReelProvider>("youtube");
  const [apiKey, setApiKey] = useState("");
  const [reels, setReels] = useState<StockReel[]>([]);
  const [searchResults, setSearchResults] = useState<StockReel[]>([]);
  const [showingSearch, setShowingSearch] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [draftInterests, setDraftInterests] = useState<string[]>([]);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [likes, setLikes] = useState<Record<string, number>>({});

  const feed = showingSearch ? searchResults : reels;

  const loadFeed = useCallback(
    async (nextSource: ReelProvider = source, force = false) => {
      setError(null);
      try {
        const result =
          nextSource === "youtube"
            ? await loadPersonalizedReels({ force })
            : await loadStockReels({ provider: nextSource, force });
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
    },
    [source],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [savedSource, savedInterests] = await Promise.all([
        getReelsProvider(),
        getReelInterests(),
      ]);
      const key = await getReelsApiKey(savedSource);
      if (!alive) return;
      setSource(savedSource);
      setApiKey(key);
      if (!savedInterests.length) {
        setDraftInterests(DEFAULT_REEL_INTERESTS.slice(0, 4));
        setPrefsOpen(true);
      }
      await loadFeed(savedSource);
    })();
    return () => {
      alive = false;
    };
  }, [loadFeed]);

  const runSearch = useCallback(async () => {
    const query = searchText.trim();
    if (!query) return;
    setSearching(true);
    setError(null);
    try {
      const result = await loadStockReels({ provider: "youtube", query: `${query} shorts` });
      setSearchResults(result.reels);
      setShowingSearch(true);
      setTab("foryou");
      setActiveIndex(0);
      setError(result.error ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not search reels.");
    } finally {
      setSearching(false);
    }
  }, [searchText]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (showingSearch && searchText.trim()) void runSearch();
    else void loadFeed(source, true);
  }, [loadFeed, runSearch, searchText, showingSearch, source]);

  const changeProvider = useCallback(
    (value: ReelProvider) => {
      setSource(value);
      setShowingSearch(false);
      void (async () => {
        await setReelsProvider(value);
        setApiKey(await getReelsApiKey(value));
        await loadFeed(value, true);
      })();
    },
    [loadFeed],
  );

  const changeKey = useCallback(
    (value: string) => {
      setApiKey(value);
      void (async () => {
        await setReelsApiKey(source, value);
        await loadFeed(source, true);
      })();
    },
    [loadFeed, source],
  );

  const saveInterests = useCallback(async () => {
    const chosen = draftInterests.length ? draftInterests : DEFAULT_REEL_INTERESTS.slice(0, 5);
    await setReelInterests(chosen);
    setPrefsOpen(false);
    setSource("youtube");
    await setReelsProvider("youtube");
    setApiKey(await getReelsApiKey("youtube"));
    setShowingSearch(false);
    setTab("foryou");
    await loadFeed("youtube", true);
  }, [draftInterests, loadFeed]);

  const toggleInterest = useCallback((value: string) => {
    setDraftInterests((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  }, []);

  const toggleLike = useCallback(
    (reel: StockReel) => {
      const next = !liked[reel.id];
      setLiked((prev) => ({ ...prev, [reel.id]: next }));
      setLikes((prev) => ({ ...prev, [reel.id]: Math.max(0, (prev[reel.id] ?? 0) + (next ? 1 : -1)) }));
      if (next) void recordReelLike(reel);
    },
    [liked],
  );

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

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
      <Pressable onPress={() => router.back()} style={styles.headerButton} hitSlop={8}>
        <Ionicons name="arrow-back" size={19} color={C.white} />
      </Pressable>
      <View style={styles.tabs}>
        {(
          [
            ["foryou", "For You"],
            ["search", "Search"],
            ["topics", "Topics"],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            style={[styles.tab, tab === id && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.headerActions}>
        <Pressable onPress={onRefresh} style={styles.headerButton} hitSlop={8}>
          <Ionicons name="refresh-outline" size={19} color={C.white} />
        </Pressable>
        <Pressable onPress={() => setSettingsVisible(true)} style={styles.headerButton} hitSlop={8}>
          <Ionicons name="options-outline" size={19} color={C.white} />
        </Pressable>
      </View>
    </View>
  );

  let content: React.ReactNode;

  if (loading) {
    content = (
      <View style={styles.center}>
        <TvSignalSearching label="OPENING WALLORA REELS" detail="Preparing your vertical feed…" compact />
      </View>
    );
  } else if (tab === "search") {
    content = (
      <ScrollView style={styles.screen} contentContainerStyle={[styles.page, { paddingTop: insets.top + 66 }]}>
        <Text style={styles.pageTitle}>Find your next reel</Text>
        <Text style={styles.pageSubtitle}>Search YouTube shorts by topic, mood, creator or vibe.</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={C.muted} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => void runSearch()}
            placeholder="Try dancing, football, cooking…"
            placeholderTextColor={C.muted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {searching ? <ActivityIndicator color={C.accent} size="small" /> : null}
        </View>
        <View style={styles.suggestionRow}>
          {["funny", "travel", "gaming", "cooking", "dance"].map((value) => (
            <Pressable
              key={value}
              onPress={() => {
                setSearchText(value);
                setSearchResults([]);
              }}
              style={styles.suggestionChip}
            >
              <Text style={styles.suggestionText}>#{value}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.primaryButton} onPress={() => void runSearch()} disabled={searching}>
          <Text style={styles.primaryButtonText}>{searching ? "Searching…" : "Search reels"}</Text>
        </Pressable>
        {searchResults.length ? (
          <View style={styles.resultGrid}>
            {searchResults.map((reel, index) => (
              <Pressable
                key={reel.id}
                onPress={() => {
                  setShowingSearch(true);
                  setActiveIndex(index);
                  setTab("foryou");
                }}
                style={styles.resultCard}
              >
                {reel.poster ? (
                  <Image source={{ uri: reel.poster }} style={styles.resultPoster} resizeMode="cover" />
                ) : (
                  <View style={[styles.resultPoster, styles.resultPlaceholder]}>
                    <Ionicons name="videocam-outline" size={24} color={C.muted} />
                  </View>
                )}
                <Text style={styles.resultTitle} numberOfLines={2}>
                  {reel.title}
                </Text>
                <Text style={styles.resultCreator} numberOfLines={1}>
                  {reel.creator}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    );
  } else if (tab === "topics") {
    content = (
      <ScrollView style={styles.screen} contentContainerStyle={[styles.page, { paddingTop: insets.top + 66 }]}>
        <Text style={styles.pageTitle}>Train your For You</Text>
        <Text style={styles.pageSubtitle}>
          Pick what you actually watch. WALLORA searches each topic, mixes the results, then ranks
          them by your likes and popularity.
        </Text>
        <InterestPicker selected={draftInterests} onToggle={toggleInterest} />
        <Pressable style={styles.primaryButton} onPress={() => void saveInterests()}>
          <Text style={styles.primaryButtonText}>Save and refresh my feed</Text>
        </Pressable>
        <Text style={styles.algorithmNote}>
          Liking a reel teaches the algorithm. Your choices and likes stay on this device.
        </Text>
      </ScrollView>
    );
  } else {
    content = (
      <View style={styles.screen}>
        <FlatList
          data={feed}
          keyExtractor={(item) => item.id}
          style={{ height: viewportHeight }}
          pagingEnabled
          decelerationRate="fast"
          overScrollMode="never"
          bounces={false}
          showsVerticalScrollIndicator={false}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={4}
          // Exact offsets make paging snap cleanly instead of drifting between reels.
          getItemLayout={(_, index) => ({
            length: viewportHeight,
            offset: viewportHeight * index,
            index,
          })}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.y / viewportHeight);
            setActiveIndex(Math.min(Math.max(index, 0), Math.max(feed.length - 1, 0)));
          }}
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
              onLike={() => toggleLike(item)}
              onShare={() => void share(item)}
              insetsBottom={insets.bottom}
              viewportHeight={viewportHeight}
            />
          )}
          ListEmptyComponent={
            <View style={[styles.empty, { height: viewportHeight }]}>
              <Ionicons name="videocam-outline" size={44} color={C.muted} />
              <Text style={styles.emptyTitle}>No reels available</Text>
              <Text style={styles.emptyText}>
                {error ?? "Choose a few topics in Topics or add a YouTube key in Source settings."}
              </Text>
              <View style={styles.emptyActions}>
                <Pressable style={styles.emptyButton} onPress={() => setPrefsOpen(true)}>
                  <Text style={styles.emptyButtonText}>Choose topics</Text>
                </Pressable>
                <Pressable style={styles.emptyButtonGhost} onPress={onRefresh}>
                  <Text style={styles.emptyButtonGhostText}>Refresh</Text>
                </Pressable>
              </View>
            </View>
          }
        />
        {showingSearch ? (
          <Pressable
            style={[styles.backToFeed, { top: insets.top + 62 }]}
            onPress={() => setShowingSearch(false)}
          >
            <Ionicons name="arrow-undo-outline" size={14} color={C.white} />
            <Text style={styles.backToFeedText}>Back to For You</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {content}
      {header}
      <ModalShell
        visible={prefsOpen}
        title="What do you want to watch?"
        onClose={() => setPrefsOpen(false)}
      >
        <Text style={styles.modalText}>
          Choose at least a few topics. WALLORA builds your For You feed from these and improves it
          every time you like a reel.
        </Text>
        <InterestPicker selected={draftInterests} onToggle={toggleInterest} />
        <Pressable style={styles.modalButton} onPress={() => void saveInterests()}>
          <Text style={styles.modalButtonText}>Build my feed</Text>
        </Pressable>
      </ModalShell>
      <SourceSettings
        visible={settingsVisible}
        provider={source}
        apiKey={apiKey}
        onProvider={changeProvider}
        onKey={changeKey}
        onClose={() => setSettingsVisible(false)}
      />
      {refreshing && feed.length === 0 ? <ActivityIndicator color={C.accent} style={styles.refreshing} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bgDeep },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bgDeep },
  page: { paddingHorizontal: 18, paddingBottom: 40 },
  pageTitle: { color: C.text, fontSize: 26, fontWeight: "900", marginTop: 10 },
  pageSubtitle: { color: C.textSoft, fontSize: 13, lineHeight: 20, marginTop: 6, marginBottom: 20 },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  headerActions: { flexDirection: "row", gap: 8 },
  headerButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)" },
  tabs: { flexDirection: "row", gap: 4, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: R.pill, padding: 3 },
  tab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.pill },
  tabActive: { backgroundColor: C.accent },
  tabText: { color: C.textSoft, fontSize: 12, fontWeight: "800" },
  tabTextActive: { color: C.bg },
  reel: { width: "100%", backgroundColor: C.bgDeep, overflow: "hidden" },
  topShade: { position: "absolute", top: 0, left: 0, right: 0, height: 150, backgroundColor: "rgba(0,0,0,0.4)" },
  bottomShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 300, backgroundColor: "rgba(0,0,0,0.55)" },
  heartBurst: { position: "absolute", alignSelf: "center", top: "42%", shadowColor: "#000", shadowRadius: 16, shadowOpacity: 0.5 },
  bufferWrap: { position: "absolute", alignSelf: "center", top: "38%" },
  bottom: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, gap: 12 },
  info: { flex: 1, minWidth: 0 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.raised, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" },
  author: { color: C.white, fontSize: 13, fontWeight: "800", flexShrink: 1 },
  sourceBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accent + "66" },
  sourceBadgeText: { color: C.accentBright, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  caption: { color: C.white, fontSize: 13, lineHeight: 19, textShadowColor: "#000", textShadowRadius: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  metaText: { color: C.textSoft, fontSize: 10, flexShrink: 1 },
  actionRail: { position: "absolute", right: 8, alignItems: "center", gap: 4 },
  railButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  railButtonPressed: { opacity: 0.6 },
  railCount: {
    color: C.white,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 12,
    textShadowColor: "#000",
    textShadowRadius: 3,
  },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, height: 48, borderRadius: R.md, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, color: C.text, fontSize: 14 },
  suggestionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  suggestionChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: R.pill, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border },
  suggestionText: { color: C.accentBright, fontSize: 11, fontWeight: "700" },
  primaryButton: { marginTop: 18, borderRadius: R.md, backgroundColor: C.accent, paddingVertical: 13, alignItems: "center" },
  primaryButtonText: { color: C.bg, fontSize: 13, fontWeight: "900" },
  resultGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 24 },
  resultCard: { width: "47%", borderRadius: R.md, overflow: "hidden", backgroundColor: C.raised, borderWidth: 1, borderColor: C.border },
  resultPoster: { width: "100%", height: 130, backgroundColor: C.bgDeep },
  resultPlaceholder: { alignItems: "center", justifyContent: "center" },
  resultTitle: { color: C.text, fontSize: 12, fontWeight: "800", paddingHorizontal: 9, paddingTop: 8 },
  resultCreator: { color: C.muted, fontSize: 10, paddingHorizontal: 9, paddingBottom: 9, marginTop: 3 },
  interestGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginVertical: 18 },
  interestChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: R.pill, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border },
  interestChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  interestText: { color: C.textSoft, fontSize: 12, fontWeight: "700" },
  interestTextActive: { color: C.bg },
  algorithmNote: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 16 },
  errorText: { color: C.error, fontSize: 12, marginTop: 14 },
  backToFeed: { position: "absolute", left: 14, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: R.pill, backgroundColor: "rgba(0,0,0,0.55)" },
  backToFeedText: { color: C.white, fontSize: 11, fontWeight: "800" },
  empty: { width: "100%", alignItems: "center", justifyContent: "center", paddingHorizontal: 30, gap: 8 },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: "800", marginTop: 10 },
  emptyText: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  emptyActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 14 },
  emptyButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: R.md, backgroundColor: C.accent },
  emptyButtonText: { color: C.bg, fontSize: 12, fontWeight: "800" },
  emptyButtonGhost: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: R.md, borderWidth: 1, borderColor: C.border },
  emptyButtonGhostText: { color: C.textSoft, fontSize: 12, fontWeight: "800" },
  modalBackdrop: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 20 },
  modalCard: { width: "100%", maxHeight: "80%", borderRadius: R.lg, backgroundColor: C.card, padding: 18, borderWidth: 1, borderColor: C.border },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: "900" },
  modalText: { color: C.textSoft, fontSize: 12, lineHeight: 18 },
  providerRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  providerChip: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: R.md, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border },
  providerChipActive: { backgroundColor: C.accentDim, borderColor: C.accent },
  providerText: { color: C.textSoft, fontSize: 11, fontWeight: "800" },
  providerTextActive: { color: C.accentBright },
  keyInput: { marginTop: 14, height: 44, borderRadius: R.md, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, color: C.text, fontSize: 12 },
  modalHint: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 8 },
  modalButton: { marginTop: 16, borderRadius: R.md, backgroundColor: C.accent, paddingVertical: 12, alignItems: "center" },
  modalButtonText: { color: C.bg, fontSize: 12, fontWeight: "900" },
  refreshing: { position: "absolute", bottom: 30, alignSelf: "center" },
});
