import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as Notifications from "expo-notifications";
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

/** Friendly, non-technical copy for anything the native player rejects. */
const MESSAGE = {
  load: "This track couldn't be loaded. Try another one.",
  play: "Playback couldn't start. Please try again.",
  pause: "Couldn't pause playback. Please try again.",
  seek: "Couldn't move within this track.",
  volume: "Couldn't adjust volume on this device.",
  rate: "Couldn't change playback speed on this device.",
  status: "Playback stopped unexpectedly. Tap play to try again.",
  empty: "Add a song to begin.",
} as const;

type FailHandler = (message: string) => void;

/**
 * Every native player call goes through one of these guards. A single failed
 * call must never take the screen down.
 */
function safeReplace(
  player: AudioPlayer,
  uri: string,
  fail?: FailHandler,
): boolean {
  try {
    player.replace({ uri });
    return true;
  } catch {
    fail?.(MESSAGE.load);
    return false;
  }
}

function safePlay(player: AudioPlayer, fail?: FailHandler): boolean {
  try {
    player.play();
    return true;
  } catch {
    fail?.(MESSAGE.play);
    return false;
  }
}

function safePause(player: AudioPlayer, fail?: FailHandler): boolean {
  try {
    player.pause();
    return true;
  } catch {
    fail?.(MESSAGE.pause);
    return false;
  }
}

function safeSeek(player: AudioPlayer, seconds: number, fail?: FailHandler) {
  const target = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  try {
    void Promise.resolve(player.seekTo(target)).catch(() => {
      fail?.(MESSAGE.seek);
    });
  } catch {
    fail?.(MESSAGE.seek);
  }
}

function safeVolume(
  player: AudioPlayer,
  value: number,
  fail?: FailHandler,
): boolean {
  try {
    player.volume = Math.max(0, Math.min(1, value));
    return true;
  } catch {
    fail?.(MESSAGE.volume);
    return false;
  }
}

function safeRate(
  player: AudioPlayer,
  rate: number,
  fail?: FailHandler,
): boolean {
  try {
    player.playbackRate = rate;
    return true;
  } catch {
    fail?.(MESSAGE.rate);
    return false;
  }
}

async function requestLockScreenPermission() {
  if (Platform.OS !== "android") return;
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing?.granted) return;
    // POST_NOTIFICATIONS on Android 13+. A denial is not fatal: playback and
    // the media session still work, only the notification is unavailable.
    await Notifications.requestPermissionsAsync();
  } catch {
    // Ignore permission failures entirely.
  }
}

async function safeLockScreen(player: AudioPlayer, track: Track) {
  await requestLockScreenPermission();
  try {
    const metadata: AudioMetadata = {
      title: track.title,
      artist: track.artist ?? "WALLORA Music",
      albumTitle: "WALLORA Music",
    };
    player.setActiveForLockScreen(true, metadata);
  } catch {
    // Lock-screen controls are best effort and must never break playback.
  }
}

function safeClearLockScreen(player: AudioPlayer) {
  try {
    player.clearLockScreenControls();
  } catch {
    // Ignore.
  }
}

function safeAudioMode() {
  try {
    void Promise.resolve(
      setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: "doNotMix",
      }),
    ).catch(() => {});
  } catch {
    // Ignore.
  }
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

function clampIndex(index: number, length: number) {
  if (!Number.isFinite(index) || length <= 0) return 0;
  return Math.max(0, Math.min(Math.floor(index), length - 1));
}

function normalizeTrack(raw: unknown): Track | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== "string" || !value.id) return null;
  if (typeof value.title !== "string" || !value.title) return null;
  if (typeof value.uri !== "string" || !value.uri) return null;
  const source = value.source;
  if (source !== "demo" && source !== "url" && source !== "local") return null;
  const addedAt =
    typeof value.addedAt === "number" && Number.isFinite(value.addedAt)
      ? value.addedAt
      : Date.now();
  return {
    id: value.id,
    title: value.title,
    artist: typeof value.artist === "string" ? value.artist : undefined,
    uri: value.uri,
    source,
    addedAt,
  };
}

function localFileExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

function parseStoredTracks(raw: string | null): Track[] | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const seen = new Set<string>();
    const tracks: Track[] = [];
    for (const item of parsed) {
      const track = normalizeTrack(item);
      if (!track || seen.has(track.id)) continue;
      // Cached imports can be purged by the OS; drop their stale entries.
      if (
        track.source === "local" &&
        Platform.OS !== "web" &&
        !localFileExists(track.uri)
      ) {
        continue;
      }
      seen.add(track.id);
      tracks.push(track);
    }
    return tracks;
  } catch {
    return null;
  }
}

function parseStoredFavorites(raw: string | null): string[] | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return null;
  }
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
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [scrubWidth, setScrubWidth] = useState(300);

  const hydratedRef = useRef(false);
  const touchedTracksRef = useRef(false);
  const touchedFavoritesRef = useRef(false);
  const loadedRef = useRef(false);
  const playRequestRef = useRef(0);
  const finishedTrackRef = useRef<string | null>(null);
  const lastStatusErrorRef = useRef<string | null>(null);

  const current = tracks[currentIndex] ?? null;
  const player = useAudioPlayer(null, { updateInterval: 400 });
  const status = useAudioPlayerStatus(player);

  const fail = useCallback((message: string) => setPlaybackError(message), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rawTracks, rawFavorites] = await Promise.all([
          AsyncStorage.getItem(TRACKS_KEY),
          AsyncStorage.getItem(FAVORITES_KEY),
        ]);
        if (cancelled) return;
        if (!touchedTracksRef.current) {
          const savedTracks = parseStoredTracks(rawTracks);
          if (savedTracks !== null) {
            setTracks(savedTracks);
            setCurrentIndex((index) => clampIndex(index, savedTracks.length));
          }
        }
        if (!touchedFavoritesRef.current) {
          const savedFavorites = parseStoredFavorites(rawFavorites);
          if (savedFavorites !== null) setFavorites(savedFavorites);
        }
      } catch {
        // Storage may be unavailable; the in-memory queue still works.
      } finally {
        if (!cancelled) hydratedRef.current = true;
      }
    })();

    // Session configuration only — never starts playback.
    safeAudioMode();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    AsyncStorage.setItem(TRACKS_KEY, JSON.stringify(tracks)).catch(() => {});
  }, [tracks]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)).catch(
      () => {},
    );
  }, [favorites]);

  /** Only called from explicit user actions (or a track finishing naturally). */
  const playTrack = useCallback(
    async (track: Track) => {
      const request = ++playRequestRef.current;
      setPlaybackError(null);
      if (!track.uri) {
        fail(MESSAGE.load);
        return;
      }
      if (!safeReplace(player, track.uri, fail)) return;
      loadedRef.current = true;
      safeVolume(player, volume, fail);
      safeRate(player, SPEEDS[speedIndex], fail);
      await safeLockScreen(player, track);
      // A newer selection may have replaced this one while awaiting permission.
      if (request !== playRequestRef.current) return;
      safePlay(player, fail);
    },
    [fail, player, speedIndex, volume],
  );

  const selectTrack = useCallback(
    (index: number, track: Track) => {
      setCurrentIndex(index);
      void playTrack(track);
    },
    [playTrack],
  );

  const advance = useCallback(
    (direction: 1 | -1, auto = false) => {
      if (!tracks.length) return;
      if (auto && repeat === "one" && current) {
        safeSeek(player, 0, fail);
        safePlay(player, fail);
        return;
      }
      let next = currentIndex + direction;
      if (shuffle) next = Math.floor(Math.random() * tracks.length);
      if (next >= tracks.length) {
        if (auto && repeat === "all") next = 0;
        else {
          safePause(player, fail);
          safeSeek(player, 0, fail);
          return;
        }
      }
      if (next < 0) next = tracks.length - 1;
      setCurrentIndex(next);
      void playTrack(tracks[next]);
    },
    [current, currentIndex, fail, player, playTrack, repeat, shuffle, tracks],
  );

  useEffect(() => {
    if (!status.didJustFinish || !loadedRef.current) {
      finishedTrackRef.current = null;
      return;
    }
    const trackId = current?.id ?? null;
    if (finishedTrackRef.current === trackId) return;
    finishedTrackRef.current = trackId;
    advance(1, true);
  }, [advance, current?.id, status.didJustFinish]);

  useEffect(() => {
    const error = status.error ?? null;
    if (error && error !== lastStatusErrorRef.current) {
      lastStatusErrorRef.current = error;
      setPlaybackError(MESSAGE.status);
    }
    if (!error) lastStatusErrorRef.current = null;
  }, [status.error]);

  const togglePlay = useCallback(() => {
    if (!current) {
      fail(MESSAGE.empty);
      return;
    }
    if (!loadedRef.current) {
      void playTrack(current);
      return;
    }
    if (status.playing) safePause(player, fail);
    else safePlay(player, fail);
  }, [current, fail, player, playTrack, status.playing]);

  const changeVolume = useCallback(
    (value: number) => {
      if (!Number.isFinite(value)) return;
      const next = Math.max(0, Math.min(1, value));
      setVolume(next);
      safeVolume(player, next, fail);
    },
    [fail, player],
  );

  const cycleSpeed = useCallback(() => {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    safeRate(player, SPEEDS[next], fail);
  }, [fail, player, speedIndex]);

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
    touchedTracksRef.current = true;
    const nextIndex = tracks.length;
    setTracks((prev) => [...prev, track]);
    setCurrentIndex(nextIndex);
    setUrlInput("");
    setShowAdd(false);
    setNotice("Track added.");
    void playTrack(track);
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
      const added: Track[] = result.assets
        .filter((asset) => typeof asset.uri === "string" && !!asset.uri)
        .map((asset) => ({
          id: makeId(asset.uri),
          title: asset.name ? titleFromFileName(asset.name) : "Local audio",
          artist: "On this device",
          uri: asset.uri,
          source: "local" as const,
          addedAt: Date.now(),
        }));
      if (!added.length) {
        setNotice("Could not import that file.");
        return;
      }
      touchedTracksRef.current = true;
      const startIndex = tracks.length;
      setTracks((prev) => [...prev, ...added]);
      setCurrentIndex(startIndex);
      setNotice(
        `${added.length} song${added.length === 1 ? "" : "s"} imported.`,
      );
      void playTrack(added[0]);
    } catch {
      setNotice("Could not import that file.");
    } finally {
      setImporting(false);
    }
  };

  const toggleFavorite = (id: string) => {
    touchedFavoritesRef.current = true;
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const removeTrack = (id: string) => {
    const index = tracks.findIndex((t) => t.id === id);
    if (index < 0) return;
    touchedTracksRef.current = true;
    if (index === currentIndex) {
      safePause(player, fail);
      safeClearLockScreen(player);
      loadedRef.current = false;
      playRequestRef.current += 1;
    }
    setTracks((prev) => prev.filter((t) => t.id !== id));
    setCurrentIndex((i) => {
      if (index < i) return i - 1;
      if (index === i) return Math.max(0, Math.min(i, tracks.length - 2));
      return i;
    });
  };

  const hasDuration = Number.isFinite(status.duration) && status.duration > 0;
  const progress =
    hasDuration && status.duration > 0
      ? Math.min(1, Math.max(0, status.currentTime / status.duration))
      : 0;
  const scrub = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => hasDuration,
        onMoveShouldSetPanResponder: () => hasDuration,
        onPanResponderGrant: (event) => {
          if (!hasDuration) return;
          const x = Math.max(
            0,
            Math.min(scrubWidth, event.nativeEvent.locationX),
          );
          safeSeek(player, (x / scrubWidth) * status.duration, fail);
        },
        onPanResponderMove: (event) => {
          if (!hasDuration) return;
          const x = Math.max(
            0,
            Math.min(scrubWidth, event.nativeEvent.locationX),
          );
          safeSeek(player, (x / scrubWidth) * status.duration, fail);
        },
      }),
    [fail, hasDuration, player, scrubWidth, status.duration],
  );

  const renderTrack = ({ item, index }: { item: Track; index: number }) => {
    const active = index === currentIndex;
    const favorite = favorites.includes(item.id);
    return (
      <View style={[styles.trackRow, active && styles.trackRowActive]}>
        <Pressable
          onPress={() => selectTrack(index, item)}
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
              onPress={() => safeSeek(player, status.currentTime - 15, fail)}
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
              onPress={() => safeSeek(player, status.currentTime + 15, fail)}
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
                  changeVolume(event.nativeEvent.locationX / 110)
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
            <Pressable onPress={cycleSpeed} style={styles.speedButton}>
              <Text style={styles.speedText}>{SPEEDS[speedIndex]}×</Text>
            </Pressable>
          </View>
        </View>

        {playbackError && (
          <Pressable
            onPress={() => setPlaybackError(null)}
            style={styles.errorBanner}
          >
            <Ionicons name="alert-circle-outline" size={15} color={C.error} />
            <Text style={styles.errorBannerText}>{playbackError}</Text>
            <Ionicons name="close-outline" size={14} color={C.error} />
          </Pressable>
        )}

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
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 18,
    marginTop: 12,
    padding: 11,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.error,
    backgroundColor: C.errorDim,
  },
  errorBannerText: { color: C.error, fontSize: 11.5, flex: 1 },
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
