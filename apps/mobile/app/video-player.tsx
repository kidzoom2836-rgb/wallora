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
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useEvent, useEventListener } from "expo";
import {
  isPictureInPictureSupported,
  useVideoPlayer,
  VideoView,
  type SubtitleTrack,
  type VideoPlayer,
  type VideoSize,
  type VideoSource,
  type VideoTrack,
} from "expo-video";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { ScreenHeader } from "../components/ui/ScreenHeader";
import { C, R, SHADOW } from "../lib/theme";

type VideoItem = {
  id: string;
  title: string;
  uri: string;
  source: "demo" | "local" | "url";
  addedAt: number;
  favorite?: boolean;
};

type ProgressEntry = {
  position: number;
  duration: number;
  updatedAt: number;
  completed?: boolean;
};

type Category = "all" | "imported" | "streams" | "continue" | "favorites";
type SortMode = "recent" | "added" | "title";
type SettingsSection = "main" | "speed" | "quality" | "subtitles" | "sleep";

const VIDEOS_KEY = "wallora.video.items.v1";
const PROGRESS_KEY = "wallora.video.progress.v1";
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const SLEEP_OPTIONS = [5, 10, 30];
const CATEGORIES: { key: Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "imported", label: "Imported" },
  { key: "streams", label: "Streams" },
  { key: "continue", label: "Continue watching" },
  { key: "favorites", label: "Favorites" },
];

/** StyleSheet.absoluteFillObject is removed in recent React Native releases. */
const FILL = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const DEMO_VIDEOS: VideoItem[] = [
  {
    id: "demo-bunny-hls",
    title: "Big Buck Bunny · HLS",
    uri: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    source: "demo",
    addedAt: 4,
  },
  {
    id: "demo-steel",
    title: "Tears of Steel · HLS",
    uri: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    source: "demo",
    addedAt: 3,
  },
  {
    id: "demo-angel",
    title: "Angel One · HLS",
    uri: "https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8",
    source: "demo",
    addedAt: 2,
  },
  {
    id: "demo-bunny-mp4",
    title: "Big Buck Bunny · MP4",
    uri: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    source: "demo",
    addedAt: 1,
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0)
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatRate(rate: number) {
  return `${Number((Number.isFinite(rate) ? rate : 1).toFixed(2))}×`;
}

function makeId(uri: string) {
  return `${Date.now().toString(36)}-${uri.length}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function titleFromUri(uri: string, fallback: string) {
  try {
    const last = uri.split("?")[0].split("/").pop() ?? "";
    return (
      decodeURIComponent(last)
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim() || fallback
    );
  } catch {
    return fallback;
  }
}

function isHls(uri: string) {
  return /\.m3u8(\?|#|$)/i.test(uri);
}

function sourceLabel(item: VideoItem) {
  if (item.source === "local") return "On this device";
  if (item.source === "url") return "Network stream";
  return "Demo stream";
}

function badgeFor(item: VideoItem) {
  if (item.source === "local") return "FILE";
  if (isHls(item.uri)) return "HLS";
  return "STREAM";
}

function subtitleKey(track: SubtitleTrack) {
  return track.id || `${track.language}-${track.label}-${track.name ?? ""}`;
}

function subtitleLabel(track: SubtitleTrack) {
  return track.label || track.name || track.language || "Subtitle track";
}

function videoTrackLabel(track: VideoTrack) {
  const height = track.size?.height ?? 0;
  const bitrate =
    track.averageBitrate ?? track.peakBitrate ?? track.bitrate ?? null;
  const resolution = height > 0 ? `${height}p` : "Video";
  const rate =
    bitrate && bitrate > 0 ? ` · ${(bitrate / 1_000_000).toFixed(1)} Mbps` : "";
  return `${resolution}${rate}`;
}

/* Every imperative player call is wrapped so a disposed player can never
   crash the screen (for example while PiP/fullscreen is changing). */
function safePlay(player: VideoPlayer) {
  try {
    player.play();
  } catch {}
}
function safePause(player: VideoPlayer) {
  try {
    player.pause();
  } catch {}
}
function safeSeek(player: VideoPlayer, seconds: number) {
  try {
    player.currentTime = Math.max(0, seconds);
  } catch {}
}
function safeSetSpeed(player: VideoPlayer, rate: number) {
  try {
    player.playbackRate = rate;
  } catch {}
}
function safeSetLoop(player: VideoPlayer, enabled: boolean) {
  try {
    player.loop = enabled;
  } catch {}
}
function safeSetMaxResolution(player: VideoPlayer, size: VideoSize | null) {
  try {
    player.maxResolution = size;
  } catch {}
}
function safeSetSubtitle(player: VideoPlayer, track: SubtitleTrack | null) {
  try {
    player.subtitleTrack = track;
  } catch {}
}
function safeCurrentTime(player: VideoPlayer) {
  try {
    return player.currentTime;
  } catch {
    return 0;
  }
}
function safeDuration(player: VideoPlayer) {
  try {
    return player.duration;
  } catch {
    return 0;
  }
}
function safeBuffered(player: VideoPlayer) {
  try {
    return player.bufferedPosition;
  } catch {
    return -1;
  }
}
function safeIsLive(player: VideoPlayer) {
  try {
    return player.isLive;
  } catch {
    return false;
  }
}
function safeVideoTracks(player: VideoPlayer): VideoTrack[] {
  try {
    return player.availableVideoTracks;
  } catch {
    return [];
  }
}
function safeSubtitleTracks(player: VideoPlayer): SubtitleTrack[] {
  try {
    return player.availableSubtitleTracks;
  } catch {
    return [];
  }
}
function safeMaxResolution(player: VideoPlayer): VideoSize | null {
  try {
    return player.maxResolution;
  } catch {
    return null;
  }
}
async function safeFullscreen(view: VideoView | null) {
  try {
    await view?.enterFullscreen();
    return true;
  } catch {
    return false;
  }
}
async function safePictureInPicture(view: VideoView | null) {
  try {
    await view?.startPictureInPicture();
    return true;
  } catch {
    return false;
  }
}

export default function VideoPlayerScreen() {
  const [items, setItems] = useState<VideoItem[]>(DEMO_VIDEOS);
  const [progress, setProgress] = useState<Record<string, ProgressEntry>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [importOpen, setImportOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection | null>(null);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [qualityChoice, setQualityChoice] = useState("auto");
  const [subtitleChoice, setSubtitleChoice] = useState("off");
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [sleepRemaining, setSleepRemaining] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [inPip, setInPip] = useState(false);
  const [scrubWidth, setScrubWidth] = useState(300);
  const [pipSupported] = useState(() => isPictureInPictureSupported());

  const videoRef = useRef<VideoView>(null);
  const hydrated = useRef(false);
  const progressRef = useRef(progress);
  const activeRef = useRef<VideoItem | null>(null);
  const lastSavedRef = useRef({ id: "", position: -1, duration: 0 });

  const activeItem = items.find((item) => item.id === activeId) ?? null;
  const activeItemId = activeItem?.id ?? null;
  const activeUri = activeItem?.uri ?? "";
  const activeTitle = activeItem?.title ?? "";
  const source = useMemo<VideoSource>(
    () =>
      activeItemId && activeUri
        ? {
            uri: activeUri,
            contentType: isHls(activeUri) ? "hls" : "auto",
            metadata: { title: activeTitle, artist: "WALLORA Video Player" },
          }
        : null,
    [activeItemId, activeUri, activeTitle],
  );

  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
    instance.staysActiveInBackground = true;
    instance.showNowPlayingNotification = true;
    instance.timeUpdateEventInterval = 0.5;
    instance.preservesPitch = true;
  });

  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });
  const { status } = useEvent(player, "statusChange", {
    status: player.status,
  });
  const { playbackRate } = useEvent(player, "playbackRateChange", {
    playbackRate: player.playbackRate,
  });
  const tick = useEvent(player, "timeUpdate", {
    currentTime: player.currentTime,
    bufferedPosition: player.bufferedPosition,
    currentLiveTimestamp: player.currentLiveTimestamp,
    currentOffsetFromLive: player.currentOffsetFromLive,
  });
  const loaded = useEvent(player, "sourceLoad", {
    videoSource: source,
    duration: player.duration,
    availableVideoTracks: player.availableVideoTracks,
    availableSubtitleTracks: player.availableSubtitleTracks,
    availableAudioTracks: player.availableAudioTracks,
  });
  const { videoTrack } = useEvent(player, "videoTrackChange", {
    videoTrack: player.videoTrack,
  });
  const { subtitleTrack } = useEvent(player, "subtitleTrackChange", {
    subtitleTrack: player.subtitleTrack,
  });
  const { availableSubtitleTracks } = useEvent(
    player,
    "availableSubtitleTracksChange",
    { availableSubtitleTracks: player.availableSubtitleTracks },
  );

  const duration = Math.max(0, safeDuration(player));
  const currentTime = tick?.currentTime ?? safeCurrentTime(player);
  const bufferedPosition = tick ? tick.bufferedPosition : safeBuffered(player);
  const liveOffset = tick?.currentOffsetFromLive ?? null;
  const videoTracks = loaded?.availableVideoTracks ?? safeVideoTracks(player);
  const subtitleTracks = availableSubtitleTracks?.length
    ? availableSubtitleTracks
    : loaded?.availableSubtitleTracks ?? safeSubtitleTracks(player);
  const resolutionCap = safeMaxResolution(player);
  const playPercent =
    duration > 0 ? clamp((currentTime / duration) * 100, 0, 100) : 0;
  const bufferedPercent =
    duration > 0 && bufferedPosition > 0
      ? clamp((bufferedPosition / duration) * 100, 0, 100)
      : 0;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [rawItems, rawProgress] = await Promise.all([
          AsyncStorage.getItem(VIDEOS_KEY),
          AsyncStorage.getItem(PROGRESS_KEY),
        ]);
        if (!mounted) return;
        if (rawItems) {
          const parsed: unknown = JSON.parse(rawItems);
          if (Array.isArray(parsed)) {
            const restored = parsed
              .filter(
                (entry): entry is VideoItem =>
                  !!entry &&
                  typeof entry === "object" &&
                  typeof (entry as VideoItem).id === "string" &&
                  typeof (entry as VideoItem).uri === "string",
              )
              .map((entry) => ({ ...entry, favorite: !!entry.favorite }));
            if (restored.length) setItems(restored);
          }
        }
        if (rawProgress) {
          const parsed: unknown = JSON.parse(rawProgress);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            setProgress(parsed as Record<string, ProgressEntry>);
          }
        }
      } catch {
        /* Corrupt storage should never block the library. */
      } finally {
        hydrated.current = true;
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (hydrated.current)
      AsyncStorage.setItem(VIDEOS_KEY, JSON.stringify(items)).catch(() => {});
  }, [items]);

  useEffect(() => {
    if (hydrated.current)
      AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)).catch(
        () => {},
      );
  }, [progress]);

  useEffect(() => {
    activeRef.current = activeItem;
  }, [activeItem]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    setIsLive(safeIsLive(player));
  }, [player, tick, status]);

  useEffect(() => {
    if (Number.isFinite(playbackRate) && playbackRate > 0)
      setSpeed(playbackRate);
  }, [playbackRate]);

  useEffect(() => {
    safeSetSpeed(player, speed);
  }, [player, speed]);

  useEffect(() => {
    safeSetLoop(player, loop);
  }, [player, loop]);

  const saveProgress = useCallback(
    (force = false, completed = false) => {
      const item = activeRef.current;
      if (!item) return;
      const position = safeCurrentTime(player);
      const total = safeDuration(player);
      if (!Number.isFinite(position) || !Number.isFinite(total) || total <= 0)
        return;
      const last = lastSavedRef.current;
      if (
        !force &&
        last.id === item.id &&
        Math.abs(position - last.position) < 3 &&
        Math.abs(total - last.duration) < 0.5
      )
        return;
      const finished = completed || position >= total - 1;
      const savedPosition = clamp(position, 0, total);
      lastSavedRef.current = {
        id: item.id,
        position: savedPosition,
        duration: total,
      };
      const entry: ProgressEntry = {
        position: savedPosition,
        duration: total,
        updatedAt: Date.now(),
        completed: finished,
      };
      const next = { ...progressRef.current, [item.id]: entry };
      progressRef.current = next;
      setProgress(next);
      AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(next)).catch(() => {});
    },
    [player],
  );

  useEventListener(player, "sourceLoad", () => {
    lastSavedRef.current = { id: "", position: -1, duration: 0 };
    const item = activeRef.current;
    if (!item) return;
    const saved = progressRef.current[item.id];
    const total = safeDuration(player);
    if (
      saved &&
      !saved.completed &&
      saved.position > 5 &&
      (!total || saved.position < total - 3)
    ) {
      safeSeek(player, Math.min(saved.position, total ? total - 1 : saved.position));
    }
    setIsLive(safeIsLive(player));
    safePlay(player);
  });

  useEventListener(player, "playToEnd", () => {
    saveProgress(true, true);
    setNotice("Finished — press play to watch again.");
  });

  useEventListener(player, "playingChange", ({ isPlaying: playing }) => {
    if (!playing) saveProgress(true);
  });

  useEffect(() => {
    if (activeRef.current && isPlaying) saveProgress(false);
  }, [tick, isPlaying, saveProgress]);

  useEffect(() => {
    if (!sleepEndsAt) {
      setSleepRemaining(0);
      return;
    }
    const update = () => {
      const left = Math.max(0, Math.ceil((sleepEndsAt - Date.now()) / 1000));
      setSleepRemaining(left);
      if (left <= 0) {
        safePause(player);
        saveProgress(true);
        setSleepEndsAt(null);
        setSleepMinutes(null);
        setNotice("Sleep timer ended — playback paused.");
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [player, sleepEndsAt, saveProgress]);

  const openItem = useCallback(
    (item: VideoItem) => {
      if (activeRef.current && activeRef.current.id !== item.id)
        saveProgress(true);
      lastSavedRef.current = { id: "", position: -1, duration: 0 };
      setQualityChoice("auto");
      setSubtitleChoice("off");
      safeSetMaxResolution(player, null);
      safeSetSubtitle(player, null);
      setSettingsSection(null);
      setFullscreen(false);
      setActiveId(item.id);
    },
    [player, saveProgress],
  );

  const backToLibrary = useCallback(() => {
    saveProgress(true);
    safePause(player);
    setSettingsSection(null);
    setActiveId(null);
  }, [player, saveProgress]);

  const toggleFavorite = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, favorite: !item.favorite } : item,
      ),
    );
  }, []);

  const removeItem = useCallback(
    (id: string) => {
      if (activeId === id) {
        safePause(player);
        setActiveId(null);
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
      setProgress((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [activeId, player],
  );

  const addUrl = useCallback(() => {
    const uri = urlInput.trim();
    if (!/^https?:\/\//i.test(uri)) {
      setNotice("Enter a direct http(s) video or HLS link.");
      return;
    }
    const item: VideoItem = {
      id: makeId(uri),
      title: titleFromUri(uri, "Network stream"),
      uri,
      source: "url",
      addedAt: Date.now(),
    };
    setItems((prev) => [...prev, item]);
    setUrlInput("");
    setUrlOpen(false);
    setImportOpen(false);
    setNotice("Stream added — opening player.");
    openItem(item);
  }, [urlInput, openItem]);

  const importFiles = useCallback(async () => {
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
      setItems((prev) => [...prev, ...added]);
      setNotice(`${added.length} video${added.length === 1 ? "" : "s"} imported.`);
      openItem(added[0]);
    } catch {
      setNotice("Could not import those files.");
    } finally {
      setImporting(false);
    }
  }, [openItem]);

  const importFromGallery = useCallback(async () => {
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
      setItems((prev) => [...prev, ...added]);
      setNotice("Video imported from gallery.");
      openItem(added[0]);
    } catch {
      setNotice("Could not import that video.");
    } finally {
      setImporting(false);
    }
  }, [openItem]);

  const seekToFraction = useCallback(
    (fraction: number) => {
      if (duration > 0)
        safeSeek(player, clamp(fraction * duration, 0, duration));
    },
    [duration, player],
  );

  const scrub = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => duration > 0,
        onMoveShouldSetPanResponder: () => duration > 0,
        onPanResponderGrant: (event) =>
          seekToFraction(event.nativeEvent.locationX / Math.max(1, scrubWidth)),
        onPanResponderMove: (event) =>
          seekToFraction(event.nativeEvent.locationX / Math.max(1, scrubWidth)),
      }),
    [duration, scrubWidth, seekToFraction],
  );

  const continueItems = useMemo(
    () =>
      items
        .filter((item) => {
          const entry = progress[item.id];
          return (
            !!entry &&
            !entry.completed &&
            entry.position > 5 &&
            entry.duration > 0 &&
            entry.position < entry.duration - 3
          );
        })
        .sort(
          (a, b) =>
            (progress[b.id]?.updatedAt ?? 0) - (progress[a.id]?.updatedAt ?? 0),
        ),
    [items, progress],
  );

  const heroItem = continueItems[0] ?? items[0] ?? null;
  const heroEntry = heroItem ? progress[heroItem.id] : undefined;

  const visibleItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      const entry = progress[item.id];
      const inProgress =
        !!entry &&
        !entry.completed &&
        entry.position > 5 &&
        entry.duration > 0 &&
        entry.position < entry.duration - 3;
      const matchesCategory =
        category === "all" ||
        (category === "imported" && item.source === "local") ||
        (category === "streams" && item.source !== "local") ||
        (category === "continue" && inProgress) ||
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
  }, [items, progress, query, category, sortMode]);

  const qualityTracks = useMemo(
    () =>
      videoTracks
        .filter(
          (track, index, all) =>
            all.findIndex(
              (other) =>
                (other.size?.height ?? 0) === (track.size?.height ?? 0) &&
                (other.size?.width ?? 0) === (track.size?.width ?? 0),
            ) === index,
        )
        .sort((a, b) => (b.size?.height ?? 0) - (a.size?.height ?? 0)),
    [videoTracks],
  );

  const applyQuality = (choice: string) => {
    setQualityChoice(choice);
    if (choice === "auto") {
      safeSetMaxResolution(player, null);
      setNotice("Quality: Auto");
      return;
    }
    const track = videoTracks.find((candidate) => candidate.id === choice);
    if (!track) return;
    const size: VideoSize = {
      width: track.size?.width ?? 0,
      height: track.size?.height ?? 0,
    };
    if (size.width > 0 && size.height > 0)
      safeSetMaxResolution(player, { width: size.width, height: size.height });
    setNotice(`Quality limited to ${videoTrackLabel(track)}.`);
  };

  const applySubtitle = (choice: string) => {
    setSubtitleChoice(choice);
    if (choice === "off") {
      safeSetSubtitle(player, null);
      setNotice("Subtitles: Off");
      return;
    }
    const track = subtitleTracks.find(
      (candidate) => subtitleKey(candidate) === choice,
    );
    if (track) {
      safeSetSubtitle(player, track);
      setNotice(`Subtitles: ${subtitleLabel(track)}`);
    }
  };

  const startSleep = (minutes: number) => {
    setSleepMinutes(minutes);
    setSleepEndsAt(Date.now() + minutes * 60_000);
    setNotice(`Sleep timer set for ${minutes} minutes.`);
  };

  const chosenQualityTrack =
    videoTracks.find((track) => track.id === qualityChoice) ?? videoTrack;
  const currentQualityLabel =
    qualityChoice === "auto"
      ? videoTrack
        ? `${videoTrack.size?.height ?? 0}p · Auto`
        : "Auto"
      : chosenQualityTrack
        ? videoTrackLabel(chosenQualityTrack)
        : "Custom";

  const chosenSubtitleTrack = subtitleTracks.find(
    (track) => subtitleKey(track) === subtitleChoice,
  );
  const currentSubtitleLabel =
    subtitleChoice === "off"
      ? "Off"
      : chosenSubtitleTrack
        ? subtitleLabel(chosenSubtitleTrack)
        : subtitleTrack
          ? subtitleLabel(subtitleTrack)
          : "Off";

  const optionRow = (
    key: string,
    label: string,
    detail: string | undefined,
    selected: boolean,
    onPress: () => void,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={({ pressed }) => [styles.optionRow, pressed && styles.pressed]}
    >
      <View style={styles.optionCopy}>
        <Text style={[styles.optionLabel, selected && styles.optionLabelActive]}>
          {label}
        </Text>
        {!!detail && <Text style={styles.optionDetail}>{detail}</Text>}
      </View>
      {selected && (
        <Ionicons
          name="checkmark-circle-outline"
          size={19}
          color={C.accent}
        />
      )}
    </Pressable>
  );

  const renderSettings = () => {
    if (settingsSection === "speed")
      return SPEEDS.map((rate) =>
        optionRow(
          `speed-${rate}`,
          formatRate(rate),
          rate === 1 ? "Normal speed" : undefined,
          Math.abs(playbackRate - rate) < 0.01,
          () => {
            safeSetSpeed(player, rate);
            setSpeed(rate);
          },
        ),
      );
    if (settingsSection === "quality") {
      const rows = [
        optionRow(
          "quality-auto",
          "Auto",
          "Player picks the best available track",
          qualityChoice === "auto",
          () => applyQuality("auto"),
        ),
        ...qualityTracks.map((track) =>
          optionRow(
            `quality-${track.id}`,
            `${track.size?.height ?? 0}p`,
            videoTrackLabel(track),
            qualityChoice === track.id,
            () => applyQuality(track.id),
          ),
        ),
      ];
      if (qualityTracks.length === 0)
        rows.push(
          <Text key="quality-empty" style={styles.sheetNote}>
            This source exposes no adaptive video tracks. Quality control is
            available for HLS streams with multiple renditions.
          </Text>,
        );
      if (videoTrack)
        rows.push(
          <Text key="quality-current" style={styles.sheetNote}>
            Now playing: {videoTrackLabel(videoTrack)}
          </Text>,
        );
      return rows;
    }
    if (settingsSection === "subtitles") {
      const rows = [
        optionRow("subtitle-off", "Off", undefined, subtitleChoice === "off", () =>
          applySubtitle("off"),
        ),
        ...subtitleTracks.map((track) =>
          optionRow(
            `subtitle-${subtitleKey(track)}`,
            subtitleLabel(track),
            track.language,
            subtitleChoice === subtitleKey(track),
            () => applySubtitle(subtitleKey(track)),
          ),
        ),
      ];
      if (subtitleTracks.length === 0)
        rows.push(
          <Text key="subtitle-empty" style={styles.sheetNote}>
            This stream has no embedded subtitles. Subtitle options will appear
            here automatically when a source provides them.
          </Text>,
        );
      return rows;
    }
    if (settingsSection === "sleep")
      return [
        optionRow(
          "sleep-off",
          "Off",
          "No automatic pause",
          sleepEndsAt === null,
          () => {
            setSleepEndsAt(null);
            setSleepMinutes(null);
            setNotice("Sleep timer turned off.");
          },
        ),
        ...SLEEP_OPTIONS.map((minutes) =>
          optionRow(
            `sleep-${minutes}`,
            `${minutes} minutes`,
            `Pause after ${minutes} min`,
            sleepMinutes === minutes,
            () => startSleep(minutes),
          ),
        ),
      ];
    return [
      optionRow(
        "row-speed",
        "Playback speed",
        formatRate(playbackRate),
        false,
        () => setSettingsSection("speed"),
      ),
      optionRow(
        "row-quality",
        "Quality",
        currentQualityLabel,
        false,
        () => setSettingsSection("quality"),
      ),
      optionRow(
        "row-subtitles",
        "Subtitles",
        currentSubtitleLabel,
        false,
        () => setSettingsSection("subtitles"),
      ),
      optionRow(
        "row-sleep",
        "Sleep timer",
        sleepEndsAt ? `${formatTime(sleepRemaining)} remaining` : "Off",
        false,
        () => setSettingsSection("sleep"),
      ),
      optionRow(
        "row-loop",
        "Loop playback",
        loop ? "On" : "Off",
        loop,
        () => {
          setLoop((value) => !value);
        },
      ),
      <Text key="main-note" style={styles.sheetNote}>
        Fullscreen and Picture-in-Picture stay available from the player
        controls.
      </Text>,
    ];
  };

  const renderGridCard = ({ item }: { item: VideoItem }) => {
    const entry = progress[item.id];
    const percent =
      entry && entry.duration > 0
        ? clamp((entry.position / entry.duration) * 100, 0, 100)
        : 0;
    return (
      <Pressable
        onPress={() => openItem(item)}
        style={({ pressed }) => [styles.gridCard, pressed && styles.pressed]}
      >
        <View style={styles.thumb}>
          <LinearGradient
            colors={[C.raised, C.bgDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={FILL}
          />
          <View style={styles.thumbGlow} />
          <Ionicons name="play" size={24} color={C.accentBright} />
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeFor(item)}</Text>
            </View>
            {!!item.favorite && (
              <Ionicons name="heart" size={13} color={C.error} />
            )}
          </View>
          <View style={styles.durationBadge}>
            <Text style={styles.badgeText}>
              {entry?.duration
                ? formatTime(entry.duration)
                : isHls(item.uri)
                  ? "LIVE?"
                  : "--:--"}
            </Text>
          </View>
          {percent > 0 && (
            <View style={styles.cardProgressTrack}>
              <View style={[styles.cardProgressFill, { width: `${percent}%` }]} />
            </View>
          )}
        </View>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.cardMetaRow}>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {sourceLabel(item)}
            </Text>
            <Pressable
              onPress={() => removeItem(item.id)}
              hitSlop={8}
              style={styles.cardRemove}
            >
              <Ionicons name="close-outline" size={14} color={C.muted} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      {!activeItem ? (
        <>
          <ScreenHeader
            title="WALLORA Video"
            subtitle="Your library · streams · Picture-in-Picture"
            right={
              <Pressable
                onPress={() => setImportOpen(true)}
                style={({ pressed }) => [
                  styles.headerButton,
                  pressed && styles.pressed,
                ]}
                hitSlop={8}
              >
                <Ionicons
                  name="folder-open-outline"
                  size={17}
                  color={C.accent}
                />
                <Text style={styles.headerButtonText}>Import</Text>
              </Pressable>
            }
          />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.libraryContent}
          >
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color={C.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search videos or links"
                placeholderTextColor={C.mutedDark}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.searchInput}
              />
              {!!query && (
                <Pressable
                  onPress={() => setQuery("")}
                  hitSlop={8}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-outline" size={17} color={C.muted} />
                </Pressable>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chipRow}
            >
              {CATEGORIES.map((entry) => (
                <Pressable
                  key={entry.key}
                  onPress={() => setCategory(entry.key)}
                  style={({ pressed }) => [
                    styles.chip,
                    category === entry.key && styles.chipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      category === entry.key && styles.chipTextActive,
                    ]}
                  >
                    {entry.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.sectionRow}>
              <View>
                <Text style={styles.sectionTitle}>Continue watching</Text>
                <Text style={styles.sectionSubtitle}>
                  {continueItems.length
                    ? `${continueItems.length} video${continueItems.length === 1 ? "" : "s"} waiting for you`
                    : "Pick up right where you left off"}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  setSortMode((mode) =>
                    mode === "recent" ? "added" : mode === "added" ? "title" : "recent",
                  )
                }
                hitSlop={8}
                style={styles.sortButton}
              >
                <Ionicons name="options-outline" size={14} color={C.muted} />
                <Text style={styles.sortText}>
                  {sortMode === "recent"
                    ? "Recent"
                    : sortMode === "added"
                      ? "Added"
                      : "A–Z"}
                </Text>
              </Pressable>
            </View>

            {heroItem ? (
              <Pressable
                onPress={() => openItem(heroItem)}
                style={({ pressed }) => [
                  styles.heroCard,
                  pressed && styles.pressed,
                ]}
              >
                <LinearGradient
                  colors={[C.raised, C.bgDeep, C.bgElevated]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={FILL}
                />
                <View style={styles.heroOrb} />
                <View style={styles.heroContent}>
                  <View style={styles.heroEyebrow}>
                    <Ionicons name="play" size={11} color={C.accent} />
                    <Text style={styles.heroEyebrowText}>
                      {heroEntry && !heroEntry.completed && heroEntry.position > 5
                        ? "CONTINUE WATCHING"
                        : "FEATURED PICK"}
                    </Text>
                  </View>
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {heroItem.title}
                  </Text>
                  <Text style={styles.heroMeta}>
                    {sourceLabel(heroItem)} ·{" "}
                    {heroEntry?.duration ? formatTime(heroEntry.duration) : "Ready to play"}
                  </Text>
                  {!!heroEntry &&
                    !heroEntry.completed &&
                    heroEntry.position > 5 &&
                    heroEntry.duration > 0 && (
                      <View style={styles.heroProgressTrack}>
                        <View
                          style={[
                            styles.heroProgressFill,
                            {
                              width: `${clamp(
                                (heroEntry.position / heroEntry.duration) * 100,
                                0,
                                100,
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                    )}
                  <View style={styles.heroCta}>
                    <Ionicons name="play" size={14} color={C.bg} />
                    <Text style={styles.heroCtaText}>
                      {heroEntry && heroEntry.position > 5
                        ? `Resume at ${formatTime(heroEntry.position)}`
                        : "Start watching"}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setImportOpen(true)}
                style={styles.heroEmpty}
              >
                <Ionicons name="film-outline" size={26} color={C.muted} />
                <Text style={styles.heroEmptyText}>
                  Import a video or paste a stream link to begin.
                </Text>
              </Pressable>
            )}

            <View style={styles.sectionRow}>
              <View>
                <Text style={styles.sectionTitle}>
                  {category === "favorites"
                    ? "Favorites"
                    : category === "continue"
                      ? "In progress"
                      : category === "imported"
                        ? "Imported videos"
                        : category === "streams"
                          ? "Streams"
                          : "All videos"}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {visibleItems.length} item{visibleItems.length === 1 ? "" : "s"}
                </Text>
              </View>
              <Pressable onPress={() => setImportOpen(true)} hitSlop={8}>
                <Text style={styles.sectionLink}>Import</Text>
              </Pressable>
            </View>

            <FlatList
              data={visibleItems}
              renderItem={renderGridCard}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              scrollEnabled={false}
              contentContainerStyle={styles.gridContent}
              ListEmptyComponent={
                <View style={styles.emptyGrid}>
                  <Ionicons
                    name="search-outline"
                    size={24}
                    color={C.mutedDark}
                  />
                  <Text style={styles.emptyGridText}>
                    No videos match this filter.
                  </Text>
                </View>
              }
            />

            <Text style={styles.footer}>
              Progress is saved on this device. Use fullscreen or
              Picture-in-Picture to keep watching while you use other apps.
            </Text>
          </ScrollView>
        </>
      ) : (
        <>
          <View style={styles.playerHeader}>
            <Pressable
              onPress={backToLibrary}
              hitSlop={10}
              style={({ pressed }) => [
                styles.circleButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="arrow-back" size={20} color={C.text} />
            </Pressable>
            <View style={styles.playerHeaderCopy}>
              <Text style={styles.playerHeaderTitle} numberOfLines={1}>
                {activeItem.title}
              </Text>
              <Text style={styles.playerHeaderSub} numberOfLines={1}>
                {sourceLabel(activeItem)} · {badgeFor(activeItem)}
              </Text>
            </View>
            <Pressable
              onPress={() => toggleFavorite(activeItem.id)}
              hitSlop={10}
              style={styles.circleButton}
            >
              <Ionicons
                name={activeItem.favorite ? "heart" : "heart-outline"}
                size={19}
                color={activeItem.favorite ? C.error : C.textSoft}
              />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.playerScroll}
          >
            <View style={styles.playerBox}>
              <VideoView
                ref={videoRef}
                player={player}
                style={FILL}
                contentFit="contain"
                nativeControls={false}
                allowsPictureInPicture={pipSupported}
                fullscreenOptions={{ enable: true, orientation: "landscape" }}
                onFullscreenEnter={() => setFullscreen(true)}
                onFullscreenExit={() => setFullscreen(false)}
                onPictureInPictureStart={() => setInPip(true)}
                onPictureInPictureStop={() => setInPip(false)}
              />

              {status === "loading" && (
                <View style={styles.playerOverlay}>
                  <ActivityIndicator color={C.accent} size="large" />
                  <Text style={styles.overlayText}>Buffering video…</Text>
                </View>
              )}
              {status === "error" && (
                <View style={styles.playerOverlay}>
                  <Ionicons
                    name="close-outline"
                    size={30}
                    color={C.error}
                  />
                  <Text style={styles.overlayText}>
                    This source could not be played. Try another video or link.
                  </Text>
                </View>
              )}

              <View style={styles.playerTopRow}>
                {isLive ? (
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                    {liveOffset !== null && (
                      <Text style={styles.liveOffset}>
                        {Math.max(0, Math.round(liveOffset))}s behind
                      </Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.playerBadge}>
                    <Ionicons name="film-outline" size={12} color={C.accent} />
                    <Text style={styles.playerBadgeText}>WALLORA PLAYER</Text>
                  </View>
                )}
                <View style={styles.playerTopActions}>
                  <Pressable
                    onPress={() => setSettingsSection("speed")}
                    style={styles.playerPill}
                  >
                    <Text style={styles.playerPillText}>
                      {formatRate(playbackRate)}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSettingsSection("main")}
                    hitSlop={8}
                    style={styles.playerIconButton}
                  >
                    <Ionicons
                      name="options-outline"
                      size={17}
                      color={C.white}
                    />
                  </Pressable>
                  {pipSupported && (
                    <Pressable
                      onPress={async () => {
                        const ok = await safePictureInPicture(videoRef.current);
                        if (!ok)
                          setNotice(
                            "Picture-in-Picture is not available for this video.",
                          );
                      }}
                      hitSlop={8}
                      style={styles.playerIconButton}
                    >
                      <Ionicons
                        name="copy-outline"
                        size={17}
                        color={inPip ? C.accent : C.white}
                      />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => {
                      safeFullscreen(videoRef.current).then((ok) => {
                        if (!ok) setNotice("Fullscreen is unavailable here.");
                      });
                    }}
                    hitSlop={8}
                    style={styles.playerIconButton}
                  >
                    <Ionicons
                      name="expand-outline"
                      size={17}
                      color={fullscreen ? C.accent : C.white}
                    />
                  </Pressable>
                </View>
              </View>

              <View style={styles.playerBottomRow}>
                <Text style={styles.playerOverlayTitle} numberOfLines={1}>
                  {activeItem.title}
                </Text>
                {sleepEndsAt && (
                  <View style={styles.sleepBadge}>
                    <Text style={styles.sleepBadgeText}>
                      SLEEP {formatTime(sleepRemaining)}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.transportCard}>
              <View style={styles.transportRow}>
                <Pressable
                  onPress={() => (isPlaying ? safePause(player) : safePlay(player))}
                  style={styles.playButton}
                >
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={19}
                    color={C.bg}
                  />
                </Pressable>
                <Pressable
                  onPress={() =>
                    safeSeek(player, Math.max(0, currentTime - 10))
                  }
                  hitSlop={8}
                >
                  <Ionicons name="play-back" size={19} color={C.textSoft} />
                </Pressable>
                <Pressable
                  onPress={() => safeSeek(player, currentTime + 10)}
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
                      style={[
                        styles.scrubBuffer,
                        { width: `${bufferedPercent}%` },
                      ]}
                    />
                    <View
                      style={[
                        styles.scrubFill,
                        { width: `${playPercent}%` },
                      ]}
                    />
                    <View
                      style={[styles.scrubThumb, { left: `${playPercent}%` }]}
                    />
                  </View>
                </View>
                <Text style={styles.timeText}>
                  {isLive ? "LIVE" : formatTime(currentTime)} /{" "}
                  {duration > 0 ? formatTime(duration) : "—"}
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.actionRow}
              >
                <Pressable
                  onPress={() => setSettingsSection("speed")}
                  style={styles.actionChip}
                >
                  <Text style={styles.actionChipText}>
                    {formatRate(playbackRate)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setSettingsSection("quality")}
                  style={styles.actionChip}
                >
                  <Ionicons name="tv-outline" size={14} color={C.accent} />
                  <Text style={styles.actionChipText}>{currentQualityLabel}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setSettingsSection("subtitles")}
                  style={styles.actionChip}
                >
                  <Ionicons
                    name="musical-notes-outline"
                    size={14}
                    color={C.accent}
                  />
                  <Text style={styles.actionChipText}>CC · {currentSubtitleLabel}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setLoop((value) => !value);
                    setNotice(loop ? "Loop turned off." : "Loop turned on.");
                  }}
                  style={[styles.actionChip, loop && styles.actionChipActive]}
                >
                  <Ionicons
                    name={loop ? "checkmark-circle-outline" : "play-skip-forward"}
                    size={14}
                    color={loop ? C.accent : C.muted}
                  />
                  <Text style={styles.actionChipText}>Loop</Text>
                </Pressable>
                <Pressable
                  onPress={() => setSettingsSection("sleep")}
                  style={styles.actionChip}
                >
                  <Text style={styles.actionChipText}>
                    {sleepEndsAt ? `Sleep ${formatTime(sleepRemaining)}` : "Sleep timer"}
                  </Text>
                </Pressable>
              </ScrollView>
            </View>

            {notice && (
              <Pressable
                onPress={() => setNotice(null)}
                style={styles.notice}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={15}
                  color={C.success}
                />
                <Text style={styles.noticeText}>{notice}</Text>
              </Pressable>
            )}

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Playback details</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Source</Text>
                <Text style={styles.infoValue}>{sourceLabel(activeItem)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Quality</Text>
                <Text style={styles.infoValue}>
                  {currentQualityLabel}
                  {videoTracks.length > 0 ? ` · ${videoTracks.length} tracks` : ""}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Resolution cap</Text>
                <Text style={styles.infoValue}>
                  {resolutionCap && resolutionCap.height > 0
                    ? `${resolutionCap.height}p max`
                    : "Unlimited (Auto)"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Subtitles</Text>
                <Text style={styles.infoValue}>
                  {currentSubtitleLabel}
                  {subtitleTracks.length === 0 ? " · no embedded tracks" : ""}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Buffered</Text>
                <Text style={styles.infoValue}>
                  {bufferedPosition >= 0
                    ? `${formatTime(bufferedPosition)} · ${Math.round(bufferedPercent)}%`
                    : "Unavailable"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Speed / loop</Text>
                <Text style={styles.infoValue}>
                  {formatRate(playbackRate)} · {loop ? "On" : "Off"}
                </Text>
              </View>
            </View>

            <Text style={styles.footer}>
              Quality uses the player’s adaptive tracks and resolution cap.
              Subtitles come from the stream itself.
            </Text>
          </ScrollView>
        </>
      )}

      {!!notice && activeId === null && (
        <Pressable onPress={() => setNotice(null)} style={styles.toast}>
          <Ionicons
            name="checkmark-circle-outline"
            size={15}
            color={C.success}
          />
          <Text style={styles.noticeText}>{notice}</Text>
        </Pressable>
      )}

      {importOpen && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setImportOpen(false)}
        >
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setImportOpen(false)}
          >
            <Pressable
              style={styles.sheetCard}
              onPress={(event) => event.stopPropagation()}
            >
              <View style={styles.sheetHandle} />
              <Text style={styles.modalEyebrow}>ADD TO LIBRARY</Text>
              <Text style={styles.modalTitle}>Import a video</Text>
              <Text style={styles.modalBody}>
                Pick a file, choose from your gallery, or paste a stream link.
              </Text>
              <Pressable
                onPress={() => {
                  setImportOpen(false);
                  void importFiles();
                }}
                disabled={importing}
                style={({ pressed }) => [
                  styles.sheetOption,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.sheetIcon}>
                  <Ionicons
                    name="folder-open-outline"
                    size={21}
                    color={C.accent}
                  />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.sheetOptionTitle}>Import files</Text>
                  <Text style={styles.optionDetail}>
                    Choose one or more videos from your device
                  </Text>
                </View>
                <Ionicons name="play-skip-forward" size={16} color={C.muted} />
              </Pressable>
              <Pressable
                onPress={() => {
                  setImportOpen(false);
                  void importFromGallery();
                }}
                disabled={importing}
                style={({ pressed }) => [
                  styles.sheetOption,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.sheetIcon}>
                  <Ionicons name="images-outline" size={21} color={C.accent} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.sheetOptionTitle}>From gallery</Text>
                  <Text style={styles.optionDetail}>
                    Pick a video from your photo library
                  </Text>
                </View>
                <Ionicons name="play-skip-forward" size={16} color={C.muted} />
              </Pressable>
              <Pressable
                onPress={() => {
                  setImportOpen(false);
                  setUrlOpen(true);
                }}
                style={({ pressed }) => [
                  styles.sheetOption,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.sheetIcon}>
                  <Ionicons name="link-outline" size={21} color={C.accent} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.sheetOptionTitle}>Stream URL</Text>
                  <Text style={styles.optionDetail}>
                    Play an MP4 link or an HLS .m3u8 playlist
                  </Text>
                </View>
                <Ionicons name="play-skip-forward" size={16} color={C.muted} />
              </Pressable>
              {importing && <ActivityIndicator color={C.accent} style={styles.sheetLoader} />}
              <Pressable
                onPress={() => setImportOpen(false)}
                style={styles.modalSecondary}
              >
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {urlOpen && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setUrlOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalEyebrow}>NETWORK STREAM</Text>
              <Text style={styles.modalTitle}>Play a video link</Text>
              <Text style={styles.modalBody}>
                Paste a direct MP4 URL or an HLS .m3u8 playlist URL.
              </Text>
              <TextInput
                value={urlInput}
                onChangeText={setUrlInput}
                placeholder="https://example.com/video.m3u8"
                placeholderTextColor={C.mutedDark}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.modalInput}
              />
              <Pressable onPress={addUrl} style={styles.modalPrimary}>
                <Ionicons name="play" size={16} color={C.bg} />
                <Text style={styles.modalPrimaryText}>Play stream</Text>
              </Pressable>
              <Pressable
                onPress={() => setUrlOpen(false)}
                style={styles.modalSecondary}
              >
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {settingsSection !== null && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setSettingsSection(null)}
        >
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setSettingsSection(null)}
          >
            <Pressable
              style={styles.sheetCard}
              onPress={(event) => event.stopPropagation()}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Pressable
                  onPress={() =>
                    setSettingsSection(
                      settingsSection === "main" ? null : "main",
                    )
                  }
                  hitSlop={8}
                  style={styles.sheetBackButton}
                >
                  <Ionicons
                    name={settingsSection === "main" ? "close-outline" : "arrow-back"}
                    size={19}
                    color={C.text}
                  />
                </Pressable>
                <Text style={styles.sheetTitle}>
                  {settingsSection === "main"
                    ? "Player settings"
                    : settingsSection === "speed"
                      ? "Playback speed"
                      : settingsSection === "quality"
                        ? "Video quality"
                        : settingsSection === "subtitles"
                          ? "Subtitles"
                          : "Sleep timer"}
                </Text>
              </View>
              <ScrollView style={styles.sheetList}>
                {renderSettings()}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  libraryContent: { paddingBottom: 40 },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  headerButtonText: { color: C.textSoft, fontSize: 12, fontWeight: "700" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 13,
    height: 46,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: {
    flex: 1,
    color: C.text,
    fontSize: 13,
    paddingVertical: 0,
  },
  clearButton: { padding: 4 },
  chipScroll: { marginTop: 14 },
  chipRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingRight: 24,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: R.pill,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: {
    backgroundColor: C.accentDim,
    borderColor: C.accent,
  },
  chipText: { color: C.muted, fontSize: 11.5, fontWeight: "700" },
  chipTextActive: { color: C.accentBright },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 11,
  },
  sectionTitle: { color: C.text, fontSize: 17, fontWeight: "800" },
  sectionSubtitle: { color: C.muted, fontSize: 11, marginTop: 3 },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: R.pill,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  sortText: { color: C.textSoft, fontSize: 11, fontWeight: "700" },
  sectionLink: { color: C.accent, fontSize: 12, fontWeight: "800" },
  heroCard: {
    marginHorizontal: 16,
    height: 190,
    borderRadius: R.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
    ...SHADOW.hero,
  },
  heroOrb: {
    position: "absolute",
    width: 210,
    height: 210,
    right: -75,
    top: -90,
    borderRadius: 105,
    backgroundColor: C.accentDim,
  },
  heroContent: { ...FILL, padding: 18, justifyContent: "flex-end" },
  heroEyebrow: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroEyebrowText: {
    color: C.accent,
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: C.text,
    fontSize: 21,
    fontWeight: "800",
    marginTop: 8,
    lineHeight: 26,
  },
  heroMeta: { color: C.textSoft, fontSize: 11.5, marginTop: 5 },
  heroProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: C.raisedHover,
    marginTop: 12,
    overflow: "hidden",
  },
  heroProgressFill: { height: 4, borderRadius: 2, backgroundColor: C.accent },
  heroCta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 13,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: R.pill,
    backgroundColor: C.accent,
  },
  heroCtaText: { color: C.bg, fontSize: 11.5, fontWeight: "800" },
  heroEmpty: {
    marginHorizontal: 16,
    height: 140,
    borderRadius: R.xl,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 30,
  },
  heroEmptyText: {
    color: C.muted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  gridContent: { paddingHorizontal: 16 },
  gridRow: { gap: 11 },
  gridCard: { flex: 1, marginBottom: 20 },
  thumb: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: R.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbGlow: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: C.accentDim,
    top: -55,
    right: -40,
  },
  badgeRow: {
    position: "absolute",
    top: 7,
    left: 7,
    right: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: R.sm,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  badgeText: {
    color: C.accentBright,
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  durationBadge: {
    position: "absolute",
    bottom: 8,
    right: 7,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: R.sm,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  cardProgressTrack: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: C.raisedHover,
  },
  cardProgressFill: { height: 3, backgroundColor: C.accent },
  cardCopy: { marginTop: 8 },
  cardTitle: { color: C.text, fontSize: 12.5, fontWeight: "700", lineHeight: 17 },
  cardMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  cardMeta: { flex: 1, color: C.muted, fontSize: 10.5 },
  cardRemove: { padding: 3 },
  emptyGrid: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 30,
  },
  emptyGridText: { color: C.muted, fontSize: 12 },
  footer: {
    color: C.mutedDark,
    fontSize: 10,
    textAlign: "center",
    lineHeight: 15,
    marginHorizontal: 26,
    marginTop: 18,
  },

  playerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSoft,
    backgroundColor: C.bg,
  },
  circleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  playerHeaderCopy: { flex: 1 },
  playerHeaderTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: "800",
  },
  playerHeaderSub: { color: C.muted, fontSize: 10.5, marginTop: 2 },
  playerScroll: { paddingBottom: 36 },
  playerBox: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: C.bgDeep,
    position: "relative",
  },
  playerOverlay: {
    ...FILL,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  overlayText: {
    color: C.textSoft,
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  playerTopRow: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  playerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  playerBadgeText: {
    color: C.accent,
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.error },
  liveText: { color: C.white, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  liveOffset: { color: C.textSoft, fontSize: 9 },
  playerTopActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  playerPill: {
    minWidth: 42,
    height: 31,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  playerPillText: { color: C.white, fontSize: 10.5, fontWeight: "800" },
  playerIconButton: {
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  playerBottomRow: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  playerOverlayTitle: {
    flex: 1,
    color: C.white,
    fontSize: 12.5,
    fontWeight: "700",
    textShadowColor: C.black,
    textShadowRadius: 4,
  },
  sleepBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: C.accentDim,
  },
  sleepBadgeText: { color: C.accentBright, fontSize: 9, fontWeight: "900" },

  transportCard: {
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    ...SHADOW.card,
  },
  transportRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  scrubArea: { flex: 1, paddingVertical: 10 },
  scrubTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: C.raisedHover,
    position: "relative",
  },
  scrubBuffer: { position: "absolute", left: 0, top: 0, height: 4, borderRadius: 2, backgroundColor: C.mutedDark },
  scrubFill: { position: "absolute", left: 0, top: 0, height: 4, borderRadius: 2, backgroundColor: C.accent },
  scrubThumb: {
    position: "absolute",
    top: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
    backgroundColor: C.accentBright,
  },
  timeText: { color: C.muted, fontSize: 10.5, minWidth: 82, textAlign: "right" },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.borderSoft,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: R.pill,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
  },
  actionChipActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  actionChipText: { color: C.textSoft, fontSize: 10.5, fontWeight: "700" },
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
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: R.md,
    backgroundColor: C.bgElevated,
    borderWidth: 1,
    borderColor: C.border,
    ...SHADOW.card,
  },
  infoCard: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 15,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoTitle: { color: C.text, fontSize: 14, fontWeight: "800", marginBottom: 10 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: C.borderSoft,
  },
  infoLabel: { color: C.muted, fontSize: 11.5 },
  infoValue: { color: C.textSoft, fontSize: 11.5, fontWeight: "600", flex: 1, textAlign: "right" },

  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: C.overlay,
  },
  sheetCard: {
    backgroundColor: C.bgElevated,
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
    maxHeight: "82%",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.raisedHover,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSoft,
  },
  sheetBackButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.card,
  },
  sheetTitle: { color: C.text, fontSize: 17, fontWeight: "800" },
  sheetList: { maxHeight: 420 },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSoft,
  },
  sheetIcon: {
    width: 42,
    height: 42,
    borderRadius: R.md,
    backgroundColor: C.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetOptionTitle: { color: C.text, fontSize: 13.5, fontWeight: "800" },
  sheetLoader: { marginTop: 10 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSoft,
  },
  optionCopy: { flex: 1 },
  optionLabel: { color: C.textSoft, fontSize: 13, fontWeight: "700" },
  optionLabelActive: { color: C.accentBright },
  optionDetail: { color: C.muted, fontSize: 10.5, marginTop: 3, lineHeight: 15 },
  sheetNote: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 17,
    paddingVertical: 12,
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: C.overlay,
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
  pressed: { opacity: 0.7 },
});
