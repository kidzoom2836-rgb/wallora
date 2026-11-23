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
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioMetadata,
  type AudioPlayer,
} from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../components/ui/ScreenHeader";
import { EmptyState } from "../components/ui/States";
import { C, R, SHADOW } from "../lib/theme";

type Track = {
  id: string;
  title: string;
  artist?: string;
  uri: string;
  source: "demo" | "url" | "local";
  addedAt: number;
};

type RepeatMode = "off" | "all" | "one";

const TRACKS_KEY = "wallora.music.tracks.v1";
const FAVORITES_KEY = "wallora.music.favorites.v1";
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

const DEMO_TRACKS: Track[] = [
  {
    id: "demo-soundhelix-1",
    title: "Sound Helix · Symphony No. 1",
    artist: "SoundHelix",
    uri: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    source: "demo",
    addedAt: 1,
  },
  {
    id: "demo-soundhelix-2",
    title: "Sound Helix · Symphony No. 2",
    artist: "SoundHelix",
    uri: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    source: "demo",
    addedAt: 2,
  },
  {
    id: "demo-soundhelix-3",
    title: "Sound Helix · Symphony No. 3",
    artist: "SoundHelix",
    uri: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    source: "demo",
    addedAt: 3,
  },
];

/** Imperative player setters live outside hooks so React's lint rules allow them. */
function applyVolume(player: AudioPlayer, value: number) {
  player.volume = value;
}

function applyRate(player: AudioPlayer, rate: number) {
  player.playbackRate = rate;
}

function formatTime(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function titleFromFileName(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Untitled track"
  );
}

function makeId(uri: string) {
  return `${Date.now().toString(36)}-${uri.length}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function MusicScreen() {
  const [tracks, setTracks] = useState<Track[]>(DEMO_TRACKS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [volume, setVolume] = useState(0.9);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [scrubWidth, setScrubWidth] = useState(300);
  const hydrated = useRef(false);

  const current = tracks[currentIndex] ?? null;
  const player = useAudioPlayer(null, { updateInterval: 400 });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(TRACKS_KEY),
      AsyncStorage.getItem(FAVORITES_KEY),
    ])
      .then(([rawTracks, rawFavorites]) => {
        if (rawTracks) {
          const parsed = JSON.parse(rawTracks) as Track[];
          if (Array.isArray(parsed) && parsed.length) setTracks(parsed);
        }
        if (rawFavorites) {
          const parsed = JSON.parse(rawFavorites) as string[];
          if (Array.isArray(parsed)) setFavorites(parsed);
        }
      })
      .catch(() => {})
      .finally(() => {
        hydrated.current = true;
      });

    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(TRACKS_KEY, JSON.stringify(tracks)).catch(() => {});
  }, [tracks]);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)).catch(
      () => {},
    );
  }, [favorites]);

  const playTrack = useCallback(
    async (track: Track) => {
      player.replace({ uri: track.uri });
      applyVolume(player, volume);
      applyRate(player, SPEEDS[speedIndex]);
      const metadata: AudioMetadata = {
        title: track.title,
        artist: track.artist ?? "WALLORA Music",
        albumTitle: "WALLORA Music",
      };
      player.setActiveForLockScreen(true, metadata);
      player.play();
    },
    [player, speedIndex, volume],
  );

  useEffect(() => {
    if (current) playTrack(current);
    // Only restart when the selected track changes, not on volume/speed changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    applyVolume(player, volume);
  }, [player, volume]);

  useEffect(() => {
    applyRate(player, SPEEDS[speedIndex]);
  }, [player, speedIndex]);

  const advance = useCallback(
    (direction: 1 | -1, auto = false) => {
      if (!tracks.length) return;
      if (auto && repeat === "one") {
        player.seekTo(0).catch(() => {});
        player.play();
        return;
      }
      let next = currentIndex + direction;
      if (shuffle) next = Math.floor(Math.random() * tracks.length);
      if (next >= tracks.length) {
        if (auto && repeat === "all") next = 0;
        else {
          player.pause();
          player.seekTo(0).catch(() => {});
          return;
        }
      }
      if (next < 0) next = tracks.length - 1;
      setCurrentIndex(next);
    },
    [currentIndex, player, repeat, shuffle, tracks.length],
  );

  useEffect(() => {
    if (!status.didJustFinish) return;
    advance(1, true);
  }, [status.didJustFinish, advance]);

  const togglePlay = () => {
    if (!current) return;
    if (status.playing) player.pause();
    else player.play();
  };

  const addUrl = () => {
    const uri = urlInput.trim();
    if (!/^https?:\/\//i.test(uri)) {
      setNotice("Enter a direct http(s) link to an audio file.");
      return;
    }
    const track: Track = {
      id: makeId(uri),
      title:
        uri
          .split("/")
          .pop()
          ?.replace(/\.[^.]+$/, "") || "Stream from URL",
      artist: "Added by you",
      uri,
      source: "url",
      addedAt: Date.now(),
    };
    setTracks((prev) => [...prev, track]);
    setCurrentIndex(tracks.length);
    setUrlInput("");
    setShowAdd(false);
    setNotice("Track added and playing.");
  };

  const importFiles = async () => {
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const added = result.assets.map((asset) => ({
        id: makeId(asset.uri),
        title: asset.name ? titleFromFileName(asset.name) : "Local audio",
        artist: "On this device",
        uri: asset.uri,
        source: "local" as const,
        addedAt: Date.now(),
      }));
      const startIndex = tracks.length;
      setTracks((prev) => [...prev, ...added]);
      setCurrentIndex(startIndex);
      setNotice(
        `${added.length} song${added.length === 1 ? "" : "s"} imported.`,
      );
    } catch {
      setNotice("Could not import that file.");
    } finally {
      setImporting(false);
    }
  };

  const toggleFavorite = (id: string) =>
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );

  const removeTrack = (id: string) => {
    const index = tracks.findIndex((t) => t.id === id);
    if (index < 0) return;
    if (index === currentIndex) {
      player.pause();
      player.clearLockScreenControls();
    }
    setTracks((prev) => prev.filter((t) => t.id !== id));
    if (index < currentIndex) setCurrentIndex((i) => i - 1);
    else if (index === currentIndex)
      setCurrentIndex(Math.min(index, tracks.length - 2));
  };

  const progress =
    status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
  const scrub = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !!status.duration,
        onMoveShouldSetPanResponder: () => !!status.duration,
        onPanResponderGrant: (event) => {
          const x = Math.max(
            0,
            Math.min(scrubWidth, event.nativeEvent.locationX),
          );
          player.seekTo((x / scrubWidth) * status.duration).catch(() => {});
        },
        onPanResponderMove: (event) => {
          const x = Math.max(
            0,
            Math.min(scrubWidth, event.nativeEvent.locationX),
          );
          player.seekTo((x / scrubWidth) * status.duration).catch(() => {});
        },
      }),
    [player, scrubWidth, status.duration],
  );

  const renderTrack = ({ item, index }: { item: Track; index: number }) => {
    const active = index === currentIndex;
    const favorite = favorites.includes(item.id);
    return (
      <View style={[styles.trackRow, active && styles.trackRowActive]}>
        <Pressable
          onPress={() => setCurrentIndex(index)}
          style={styles.trackMain}
          hitSlop={4}
        >
          <View style={[styles.trackIndex, active && styles.trackIndexActive]}>
            {active && status.playing ? (
              <Ionicons name="musical-notes" size={13} color={C.bg} />
            ) : (
              <Text
                style={[
                  styles.trackIndexText,
                  active && styles.trackIndexTextActive,
                ]}
              >
                {index + 1}
              </Text>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text
              style={[styles.trackTitle, active && styles.trackTitleActive]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {item.artist} ·{" "}
              {item.source === "local"
                ? "On device"
                : item.source === "url"
                  ? "Stream"
                  : "Demo"}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => toggleFavorite(item.id)}
          hitSlop={8}
          style={styles.iconButton}
        >
          <Ionicons
            name={favorite ? "heart" : "heart-outline"}
            size={17}
            color={favorite ? C.error : C.muted}
          />
        </Pressable>
        <Pressable
          onPress={() => removeTrack(item.id)}
          hitSlop={8}
          style={styles.iconButton}
        >
          <Ionicons name="close-outline" size={17} color={C.muted} />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="WALLORA Music"
        subtitle={`${tracks.length} tracks · plays in background`}
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
        <View style={styles.nowPlayingCard}>
          <View style={styles.nowPlayingGlow} />
          <View style={styles.artwork}>
            <Ionicons name="musical-notes" size={40} color={C.accent} />
          </View>
          <Text style={styles.eyebrow}>NOW PLAYING</Text>
          <Text style={styles.songTitle} numberOfLines={2}>
            {current?.title ?? "Nothing queued"}
          </Text>
          <Text style={styles.songArtist} numberOfLines={1}>
            {current?.artist ?? "Add a song to begin"}
          </Text>

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
              <View
                style={[styles.scrubThumb, { left: `${progress * 100}%` }]}
              />
            </View>
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>
              {formatTime(status.currentTime)}
            </Text>
            <Text style={styles.timeText}>{formatTime(status.duration)}</Text>
          </View>

          {status.isBuffering && (
            <View style={styles.buffering}>
              <ActivityIndicator color={C.accent} size="small" />
              <Text style={styles.bufferingText}>Buffering…</Text>
            </View>
          )}

          <View style={styles.controls}>
            <Pressable
              onPress={() => setShuffle((v) => !v)}
              hitSlop={8}
              style={[styles.modeButton, shuffle && styles.modeButtonActive]}
            >
              <Ionicons
                name="shuffle"
                size={18}
                color={shuffle ? C.accent : C.muted}
              />
            </Pressable>
            <Pressable
              onPress={() =>
                player
                  .seekTo(Math.max(0, status.currentTime - 15))
                  .catch(() => {})
              }
              hitSlop={8}
              style={styles.skipButton}
            >
              <Ionicons name="play-back" size={22} color={C.textSoft} />
              <Text style={styles.skipLabel}>15</Text>
            </Pressable>
            <Pressable onPress={() => advance(-1)} hitSlop={8}>
              <Ionicons name="play-skip-back" size={26} color={C.text} />
            </Pressable>
            <Pressable onPress={togglePlay} style={styles.playButton}>
              {status.playing ? (
                <Ionicons name="pause" size={25} color={C.bg} />
              ) : (
                <Ionicons name="play" size={25} color={C.bg} />
              )}
            </Pressable>
            <Pressable onPress={() => advance(1)} hitSlop={8}>
              <Ionicons name="play-skip-forward" size={26} color={C.text} />
            </Pressable>
            <Pressable
              onPress={() =>
                player.seekTo(status.currentTime + 15).catch(() => {})
              }
              hitSlop={8}
              style={styles.skipButton}
            >
              <Ionicons name="play-forward" size={22} color={C.textSoft} />
              <Text style={styles.skipLabel}>15</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setRepeat((mode) =>
                  mode === "off" ? "all" : mode === "all" ? "one" : "off",
                )
              }
              hitSlop={8}
              style={[
                styles.modeButton,
                repeat !== "off" && styles.modeButtonActive,
              ]}
            >
              <Ionicons
                name={repeat === "one" ? "repeat" : "repeat-outline"}
                size={18}
                color={repeat !== "off" ? C.accent : C.muted}
              />
              {repeat === "one" && <Text style={styles.repeatOne}>1</Text>}
            </Pressable>
          </View>

          <View style={styles.extraControls}>
            <View style={styles.volumeRow}>
              <Ionicons name="volume-low" size={15} color={C.muted} />
              <Pressable
                style={styles.volumeBar}
                onPress={(event) =>
                  setVolume(
                    Math.max(0, Math.min(1, event.nativeEvent.locationX / 110)),
                  )
                }
              >
                <View style={styles.volumeBarFill} />
                <View
                  style={[
                    styles.volumeBarActive,
                    { width: `${volume * 100}%` },
                  ]}
                />
              </Pressable>
              <Ionicons name="volume-high" size={15} color={C.muted} />
            </View>
            <Pressable
              onPress={() => setSpeedIndex((i) => (i + 1) % SPEEDS.length)}
              style={styles.speedButton}
            >
              <Text style={styles.speedText}>{SPEEDS[speedIndex]}×</Text>
            </Pressable>
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

        <View style={styles.libraryActions}>
          <Pressable
            onPress={() => setShowAdd(true)}
            style={styles.libraryButton}
          >
            <Ionicons name="link-outline" size={16} color={C.accent} />
            <Text style={styles.libraryButtonText}>Add URL</Text>
          </Pressable>
          <Pressable
            onPress={importFiles}
            disabled={importing}
            style={styles.libraryButton}
          >
            {importing ? (
              <ActivityIndicator color={C.accent} size="small" />
            ) : (
              <Ionicons name="folder-open-outline" size={16} color={C.accent} />
            )}
            <Text style={styles.libraryButtonText}>Import audio</Text>
          </Pressable>
        </View>

        <View style={styles.queueHeader}>
          <Text style={styles.queueTitle}>Your queue</Text>
          <Text style={styles.queueSub}>
            Tap a song to play · saved on this device
          </Text>
        </View>

        {tracks.length === 0 ? (
          <EmptyState
            icon="musical-notes-outline"
            title="Your queue is empty"
            message="Add a stream URL or import songs from your device."
            actionLabel="Add a song"
            onAction={() => setShowAdd(true)}
          />
        ) : (
          <FlatList
            data={tracks}
            renderItem={renderTrack}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        )}

        <Text style={styles.footer}>
          Music keeps playing in the background with lock-screen controls.
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
              <Text style={styles.modalEyebrow}>ADD TO QUEUE</Text>
              <Text style={styles.modalTitle}>Play from a link</Text>
              <Text style={styles.modalBody}>
                Paste a direct link to an MP3, M4A or other audio file.
              </Text>
              <TextInput
                value={urlInput}
                onChangeText={setUrlInput}
                placeholder="https://example.com/song.mp3"
                placeholderTextColor={C.mutedDark}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.modalInput}
              />
              <Pressable onPress={addUrl} style={styles.modalPrimary}>
                <Ionicons name="play" size={16} color={C.bg} />
                <Text style={styles.modalPrimaryText}>Add and play</Text>
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
  nowPlayingCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    padding: 18,
    alignItems: "center",
    overflow: "hidden",
    ...SHADOW.card,
  },
  nowPlayingGlow: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(215,184,121,0.10)",
    top: -120,
    right: -80,
  },
  artwork: {
    width: 108,
    height: 108,
    borderRadius: 22,
    backgroundColor: C.bgDeep,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  eyebrow: {
    color: C.accent,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  songTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 7,
  },
  songArtist: { color: C.muted, fontSize: 12, marginTop: 4 },
  scrubArea: { width: "100%", marginTop: 20, paddingVertical: 8 },
  scrubTrack: { height: 4, borderRadius: 2, backgroundColor: C.raisedHover },
  scrubFill: { height: 4, borderRadius: 2, backgroundColor: C.accent },
  scrubThumb: {
    position: "absolute",
    top: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.accentBright,
    marginLeft: -5,
  },
  timeRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  timeText: { color: C.muted, fontSize: 10 },
  buffering: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 6,
  },
  bufferingText: { color: C.muted, fontSize: 10 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 14,
  },
  modeButton: { width: 30, alignItems: "center" },
  modeButtonActive: {},
  skipButton: { alignItems: "center" },
  skipLabel: { color: C.muted, fontSize: 8, fontWeight: "800", marginTop: -3 },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW.glowGold,
  },
  repeatOne: {
    position: "absolute",
    top: -5,
    right: 2,
    color: C.accent,
    fontSize: 8,
    fontWeight: "900",
  },
  extraControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    width: "100%",
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.borderSoft,
  },
  volumeRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7 },
  volumeBar: { width: 110, height: 20, justifyContent: "center" },
  volumeBarFill: {
    position: "absolute",
    height: 4,
    width: "100%",
    borderRadius: 2,
    backgroundColor: C.raisedHover,
  },
  volumeBarActive: { height: 4, borderRadius: 2, backgroundColor: C.accent },
  speedButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.border,
  },
  speedText: { color: C.textSoft, fontSize: 11, fontWeight: "800" },
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
  libraryActions: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 18,
  },
  libraryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  libraryButtonText: { color: C.textSoft, fontSize: 12, fontWeight: "700" },
  queueHeader: { marginHorizontal: 16, marginTop: 24, marginBottom: 8 },
  queueTitle: { color: C.text, fontSize: 17, fontWeight: "800" },
  queueSub: { color: C.muted, fontSize: 11, marginTop: 3 },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSoft,
  },
  trackRowActive: { backgroundColor: C.accentDim },
  trackMain: { flex: 1, flexDirection: "row", alignItems: "center" },
  trackIndex: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  trackIndexActive: { backgroundColor: C.accent },
  trackIndexText: { color: C.muted, fontSize: 10, fontWeight: "800" },
  trackIndexTextActive: { color: C.bg },
  trackTitle: { color: C.text, fontSize: 12.5, fontWeight: "700" },
  trackTitleActive: { color: C.accentBright },
  trackArtist: { color: C.muted, fontSize: 10, marginTop: 2 },
  iconButton: { padding: 6 },
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
