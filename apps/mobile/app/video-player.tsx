import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEvent } from "expo";
import {
  isPictureInPictureSupported,
  useVideoPlayer,
  VideoView,
  type VideoPlayer,
} from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../components/ui/ScreenHeader";
import { C, R, SHADOW } from "../lib/theme";

type VideoItem = {
  id: string;
  title: string;
  uri: string;
  source: "demo" | "local" | "url";
  addedAt: number;
};

const VIDEOS_KEY = "wallora.video.items.v1";
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const FILL = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const DEMO_VIDEOS: VideoItem[] = [
  {
    id: "demo-bunny",
    title: "Big Buck Bunny · HLS demo",
    uri: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    source: "demo",
    addedAt: 1,
  },
  {
    id: "demo-steel",
    title: "Tears of Steel · HLS demo",
    uri: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    source: "demo",
    addedAt: 2,
  },
  {
    id: "demo-angel",
    title: "Angel One · HLS demo",
    uri: "https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8",
    source: "demo",
    addedAt: 3,
  },
];

/** Imperative player setters live outside hooks so React's lint rules allow them. */
function applyRate(player: VideoPlayer, rate: number) {
  player.playbackRate = rate;
}

function seekVideo(player: VideoPlayer, seconds: number) {
  player.currentTime = seconds;
}

function formatTime(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function makeId(uri: string) {
  return `${Date.now().toString(36)}-${uri.length}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function VideoPlayerScreen() {
  const [items, setItems] = useState<VideoItem[]>(DEMO_VIDEOS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [scrubWidth, setScrubWidth] = useState(300);
  const [pipSupported] = useState(() => isPictureInPictureSupported());
  const videoRef = useRef<VideoView>(null);
  const hydrated = useRef(false);

  const current = items[currentIndex] ?? null;
  const player = useVideoPlayer(
    current
      ? {
          uri: current.uri,
          metadata: { title: current.title, artist: "WALLORA Video Player" },
        }
      : null,
    (instance) => {
      instance.loop = false;
      instance.staysActiveInBackground = true;
      instance.showNowPlayingNotification = true;
      instance.timeUpdateEventInterval = 0.5;
    },
  );
  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });
  const { status } = useEvent(player, "statusChange", {
    status: player.status,
  });
  const timeUpdate = useEvent(player, "timeUpdate", null);
  const currentTime = timeUpdate?.currentTime ?? 0;

  useEffect(() => {
    AsyncStorage.getItem(VIDEOS_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as VideoItem[];
        if (Array.isArray(parsed) && parsed.length) setItems(parsed);
      })
      .catch(() => {})
      .finally(() => {
        hydrated.current = true;
      });
  }, []);

  useEffect(() => {
    if (hydrated.current)
      AsyncStorage.setItem(VIDEOS_KEY, JSON.stringify(items)).catch(() => {});
  }, [items]);

  const currentUri = current?.uri;
  useEffect(() => {
    if (currentUri) player.play();
  }, [currentUri, player]);

  useEffect(() => {
    applyRate(player, SPEEDS[speedIndex]);
  }, [player, speedIndex]);

  const addUrl = () => {
    const uri = urlInput.trim();
    if (!/^https?:\/\//i.test(uri)) {
      setNotice("Enter a direct http(s) video or HLS link.");
      return;
    }
    const item: VideoItem = {
      id: makeId(uri),
      title:
        uri
          .split("/")
          .pop()
          ?.replace(/\.[^.]+$/, "") || "Network video",
      uri,
      source: "url",
      addedAt: Date.now(),
    };
    setItems((prev) => [...prev, item]);
    setCurrentIndex(items.length);
    setUrlInput("");
    setShowAdd(false);
    setNotice("Stream added and playing.");
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
      const added = result.assets.map((asset) => ({
        id: makeId(asset.uri),
        title: asset.name?.replace(/\.[^.]+$/, "") ?? "Local video",
        uri: asset.uri,
        source: "local" as const,
        addedAt: Date.now(),
      }));
      setCurrentIndex(items.length);
      setItems((prev) => [...prev, ...added]);
      setNotice(
        `${added.length} video${added.length === 1 ? "" : "s"} imported.`,
      );
    } catch {
      setNotice("Could not import that video.");
    } finally {
      setImporting(false);
    }
  };

  const importFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setNotice("Gallery permission is needed to pick videos.");
      return;
    }
    setImporting(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
      });
      if (result.canceled || !result.assets?.length) return;
      const added = result.assets.map((asset) => ({
        id: makeId(asset.uri),
        title: asset.fileName?.replace(/\.[^.]+$/, "") ?? "Gallery video",
        uri: asset.uri,
        source: "local" as const,
        addedAt: Date.now(),
      }));
      setCurrentIndex(items.length);
      setItems((prev) => [...prev, ...added]);
      setNotice("Video imported from gallery.");
    } catch {
      setNotice("Could not import that video.");
    } finally {
      setImporting(false);
    }
  };

  const removeItem = (id: string) => {
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return;
    if (index === currentIndex) player.pause();
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (index < currentIndex) setCurrentIndex((i) => i - 1);
    else if (index === currentIndex)
      setCurrentIndex(Math.min(index, items.length - 2));
  };

  const duration = player.duration || 0;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const seekToFraction = useCallback(
    (fraction: number) => {
      if (duration > 0)
        seekVideo(player, Math.max(0, Math.min(duration, fraction * duration)));
    },
    [duration, player],
  );
  const scrub = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => duration > 0,
        onMoveShouldSetPanResponder: () => duration > 0,
        onPanResponderGrant: (event) =>
          seekToFraction(event.nativeEvent.locationX / scrubWidth),
        onPanResponderMove: (event) =>
          seekToFraction(event.nativeEvent.locationX / scrubWidth),
      }),
    [duration, scrubWidth, seekToFraction],
  );

  const renderItem = ({ item, index }: { item: VideoItem; index: number }) => {
    const active = index === currentIndex;
    return (
      <Pressable
        onPress={() => setCurrentIndex(index)}
        style={({ pressed }) => [
          styles.itemRow,
          active && styles.itemRowActive,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.itemThumb, active && styles.itemThumbActive]}>
          <Ionicons
            name={
              item.source === "local" ? "film-outline" : "play-circle-outline"
            }
            size={19}
            color={active ? C.bg : C.accent}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text
            style={[styles.itemTitle, active && styles.itemTitleActive]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={styles.itemMeta}>
            {item.source === "local"
              ? "On this device"
              : item.source === "url"
                ? "Network stream"
                : "Demo stream"}
          </Text>
        </View>
        <Pressable
          onPress={() => removeItem(item.id)}
          hitSlop={8}
          style={{ padding: 6 }}
        >
          <Ionicons name="close-outline" size={17} color={C.muted} />
        </Pressable>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="WALLORA Video Player"
        subtitle="Import videos · watch streams · Picture-in-Picture"
        right={
          <Pressable
            onPress={() => setShowAdd(true)}
            hitSlop={10}
            style={styles.headerButton}
          >
            <Ionicons name="add" size={21} color={C.text} />
          </Pressable>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.playerCard}>
          <View style={styles.playerBox}>
            {current ? (
              <VideoView
                ref={videoRef}
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                nativeControls={false}
                allowsPictureInPicture={pipSupported}
                fullscreenOptions={{ enable: true, orientation: "landscape" }}
              />
            ) : (
              <View style={styles.playerPlaceholder}>
                <Ionicons name="film-outline" size={34} color={C.muted} />
                <Text style={styles.playerPlaceholderText}>
                  Import a video to start watching
                </Text>
              </View>
            )}

            {status === "loading" && (
              <View style={styles.playerOverlay}>
                <ActivityIndicator color={C.accent} size="large" />
                <Text style={styles.overlayText}>Loading video…</Text>
              </View>
            )}
            {status === "error" && (
              <View style={styles.playerOverlay}>
                <Ionicons
                  name="alert-circle-outline"
                  size={28}
                  color={C.error}
                />
                <Text style={styles.overlayText}>
                  This video could not be played. Try another source.
                </Text>
              </View>
            )}

            <View style={styles.playerTop}>
              <View style={styles.playerBadge}>
                <Ionicons name="film-outline" size={12} color={C.accent} />
                <Text style={styles.playerBadgeText}>WALLORA PLAYER</Text>
              </View>
              <View style={styles.playerTopActions}>
                <Pressable
                  onPress={() => setSpeedIndex((i) => (i + 1) % SPEEDS.length)}
                  style={styles.playerIconButton}
                >
                  <Text style={styles.playerSpeedText}>
                    {SPEEDS[speedIndex]}×
                  </Text>
                </Pressable>
                {pipSupported && (
                  <Pressable
                    onPress={() =>
                      videoRef.current?.startPictureInPicture().catch(() => {})
                    }
                    style={styles.playerIconButton}
                  >
                    <Ionicons name="copy-outline" size={17} color={C.white} />
                  </Pressable>
                )}
              </View>
            </View>

            <View style={styles.playerBottom}>
              <Text style={styles.playerTitle} numberOfLines={1}>
                {current?.title ?? "Nothing loaded"}
              </Text>
              <Pressable
                onPress={() =>
                  videoRef.current?.enterFullscreen().catch(() => {})
                }
                style={styles.fullscreenButton}
              >
                <Ionicons name="expand-outline" size={18} color={C.bg} />
              </Pressable>
            </View>
          </View>

          <View style={styles.playerControls}>
            <Pressable
              onPress={() => (isPlaying ? player.pause() : player.play())}
              style={styles.playButton}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={19}
                color={C.bg}
              />
            </Pressable>
            <Pressable
              onPress={() => seekVideo(player, Math.max(0, currentTime - 10))}
              hitSlop={8}
            >
              <Ionicons name="play-back" size={19} color={C.textSoft} />
            </Pressable>
            <Pressable
              onPress={() => seekVideo(player, currentTime + 10)}
              hitSlop={8}
            >
              <Ionicons name="play-forward" size={19} color={C.textSoft} />
            </Pressable>
            <View
              style={styles.scrubArea}
              onLayout={(event) =>
                setScrubWidth(Math.max(1, event.nativeEvent.layout.width))
              }
              {...scrub.panHandlers}
            >
              <View style={styles.scrubTrack}>
                <View
                  style={[styles.scrubFill, { width: `${progress * 100}%` }]}
                />
              </View>
            </View>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          </View>
        </View>

        {notice && (
          <Pressable onPress={() => setNotice(null)} style={styles.notice}>
            <Ionicons
              name="checkmark-circle-outline"
              size={15}
              color={C.success}
            />
            <Text style={styles.noticeText}>{notice}</Text>
          </Pressable>
        )}

        <View style={styles.importRow}>
          <Pressable
            onPress={importFiles}
            disabled={importing}
            style={styles.importButton}
          >
            {importing ? (
              <ActivityIndicator color={C.accent} size="small" />
            ) : (
              <Ionicons name="folder-open-outline" size={16} color={C.accent} />
            )}
            <Text style={styles.importText}>Import files</Text>
          </Pressable>
          <Pressable
            onPress={importFromGallery}
            disabled={importing}
            style={styles.importButton}
          >
            <Ionicons name="images-outline" size={16} color={C.accent} />
            <Text style={styles.importText}>From gallery</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowAdd(true)}
            style={styles.importButton}
          >
            <Ionicons name="link-outline" size={16} color={C.accent} />
            <Text style={styles.importText}>Stream URL</Text>
          </Pressable>
        </View>

        <View style={styles.queueHeader}>
          <Text style={styles.queueTitle}>Your videos</Text>
          <Text style={styles.queueSub}>
            Imported files and streams stay on this device
          </Text>
        </View>
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />

        <Text style={styles.footer}>
          Use fullscreen or Picture-in-Picture to keep watching while using
          other apps.
        </Text>
      </ScrollView>

      {showAdd && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setShowAdd(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalEyebrow}>NETWORK STREAM</Text>
              <Text style={styles.modalTitle}>Play a video link</Text>
              <Text style={styles.modalBody}>
                Paste an MP4 link or an HLS .m3u8 playlist URL.
              </Text>
              <TextInput
                value={urlInput}
                onChangeText={setUrlInput}
                placeholder="https://example.com/video.m3u8"
                placeholderTextColor={C.mutedDark}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.modalInput}
              />
              <Pressable onPress={addUrl} style={styles.modalPrimary}>
                <Ionicons name="play" size={16} color={C.bg} />
                <Text style={styles.modalPrimaryText}>Play stream</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowAdd(false)}
                style={styles.modalSecondary}
              >
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 40 },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  playerCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: R.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    ...SHADOW.card,
  },
  playerBox: { width: "100%", aspectRatio: 16 / 9, backgroundColor: C.bgDeep },
  playerPlaceholder: {
    ...FILL,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  playerPlaceholderText: { color: C.muted, fontSize: 12 },
  playerOverlay: {
    ...FILL,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  overlayText: {
    color: C.textSoft,
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 30,
  },
  playerTop: {
    position: "absolute",
    top: 9,
    left: 9,
    right: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  playerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  playerBadgeText: {
    color: C.accent,
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  playerTopActions: { flexDirection: "row", gap: 6 },
  playerIconButton: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  playerSpeedText: { color: C.white, fontSize: 10, fontWeight: "800" },
  playerBottom: {
    position: "absolute",
    left: 11,
    right: 11,
    bottom: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  playerTitle: {
    flex: 1,
    color: C.white,
    fontSize: 12.5,
    fontWeight: "700",
    textShadowColor: "#000",
    textShadowRadius: 4,
  },
  fullscreenButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  playerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  scrubArea: { flex: 1, paddingVertical: 8 },
  scrubTrack: { height: 3, borderRadius: 2, backgroundColor: C.raisedHover },
  scrubFill: { height: 3, borderRadius: 2, backgroundColor: C.accent },
  timeText: { color: C.muted, fontSize: 10 },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 18,
    marginTop: 12,
    padding: 11,
    borderRadius: R.md,
    backgroundColor: C.successDim,
  },
  noticeText: { color: C.success, fontSize: 11.5, flex: 1 },
  importRow: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 18,
  },
  importButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 11,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  importText: { color: C.textSoft, fontSize: 10.5, fontWeight: "700" },
  queueHeader: { marginHorizontal: 16, marginTop: 24, marginBottom: 8 },
  queueTitle: { color: C.text, fontSize: 17, fontWeight: "800" },
  queueSub: { color: C.muted, fontSize: 11, marginTop: 3 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSoft,
  },
  itemRowActive: { backgroundColor: C.accentDim },
  pressed: { opacity: 0.7 },
  itemThumb: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  itemThumbActive: { backgroundColor: C.accent },
  itemTitle: { color: C.text, fontSize: 12.5, fontWeight: "700" },
  itemTitleActive: { color: C.accentBright },
  itemMeta: { color: C.muted, fontSize: 10, marginTop: 2 },
  footer: {
    color: C.mutedDark,
    fontSize: 10,
    textAlign: "center",
    marginHorizontal: 24,
    marginTop: 22,
    lineHeight: 15,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.78)",
    padding: 22,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: C.bgElevated,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.border,
    padding: 22,
  },
  modalEyebrow: {
    color: C.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  modalTitle: { color: C.text, fontSize: 21, fontWeight: "800", marginTop: 7 },
  modalBody: {
    color: C.textSoft,
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 8,
  },
  modalInput: {
    marginTop: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: C.text,
    fontSize: 12,
  },
  modalPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: C.accent,
    borderRadius: R.md,
    paddingVertical: 14,
    marginTop: 16,
  },
  modalPrimaryText: { color: C.bg, fontWeight: "800", fontSize: 14 },
  modalSecondary: { alignItems: "center", paddingVertical: 13, marginTop: 6 },
  modalSecondaryText: { color: C.muted, fontWeight: "700", fontSize: 12.5 },
});
