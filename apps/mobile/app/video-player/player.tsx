import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEvent } from "expo";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  isPictureInPictureSupported,
  useVideoPlayer,
  VideoView,
  type SubtitleTrack,
  type VideoPlayer,
  type VideoSize,
  type VideoSource,
} from "expo-video";

import { EmptyState } from "../../components/ui/States";
import { TvWatermark } from "../../components/media/TvWatermark";
import { C, R } from "../../lib/theme";
import {
  clamp,
  formatRate,
  formatTime,
  isHls,
  loadVideoLibrary,
  loadVideoProgress,
  saveVideoProgress,
  type ProgressEntry,
  type VideoItem,
} from "../../lib/videoLibrary";
import {
  DEFAULT_VIDEO_SETTINGS,
  getVideoSettings,
  videoQualityHeight,
  type VideoSettings,
} from "../../lib/videoSettings";

const FILL = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

/** Keep hook-returned player mutations behind helpers so lint can verify intent. */
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

function withRetryBuster(uri: string, retry: number): string {
  if (!retry) return uri;
  const separator = uri.includes("?") ? "&" : "?";
  return `${uri}${separator}_wallora_retry=${retry}&_=${Date.now()}`;
}

export default function VideoPlayerScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<VideoItem | null>(null);
  const [settings, setSettings] = useState<VideoSettings>(DEFAULT_VIDEO_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [qualityIndex, setQualityIndex] = useState(0);
  const [subtitleIndex, setSubtitleIndex] = useState(0);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);
  const [sleepRemaining, setSleepRemaining] = useState(0);
  const [scrubWidth, setScrubWidth] = useState(300);
  const [retryKey, setRetryKey] = useState(0);

  const videoRef = useRef<VideoView>(null);
  const savedProgressRef = useRef<Record<string, ProgressEntry>>({});
  const lastSavedRef = useRef({ position: -1, duration: 0 });
  const itemRef = useRef<VideoItem | null>(null);
  const autoplayRef = useRef(settings.autoplay);
  const pipSupported = useMemo(() => isPictureInPictureSupported(), []);

  useEffect(() => {
    let alive = true;
    Promise.all([loadVideoLibrary(), loadVideoProgress(), getVideoSettings()])
      .then(([library, progress, videoSettings]) => {
        if (!alive) return;
        const found = library.find((entry) => entry.id === params.id) ?? library[0] ?? null;
        setItem(found);
        setSettings(videoSettings);
        savedProgressRef.current = progress;
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [params.id]);

  useEffect(() => {
    itemRef.current = item;
  }, [item]);

  useEffect(() => {
    autoplayRef.current = settings.autoplay;
  }, [settings.autoplay]);

  const currentItemId = item?.id;
  useEffect(() => {
    if (currentItemId && settings.sleepMinutes) {
      setSleepEndsAt(Date.now() + settings.sleepMinutes * 60_000);
    }
  }, [currentItemId, settings.sleepMinutes]);

  const source = useMemo<VideoSource | null>(
    () =>
      item?.uri
        ? {
            uri: withRetryBuster(item.uri, retryKey),
            contentType: isHls(item.uri) ? "hls" : "auto",
            metadata: {
              title: item.title,
              artist: "WALLORA Video Player",
            },
          }
        : null,
    [item, retryKey],
  );

  const player = useVideoPlayer(source, (instance) => {
    instance.staysActiveInBackground = true;
    instance.showNowPlayingNotification = true;
    instance.timeUpdateEventInterval = 0.5;
    instance.preservesPitch = true;
  });

  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });
  const { status, error } = useEvent(player, "statusChange", {
    status: player.status,
    error: undefined,
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

  const duration = Math.max(0, loaded?.duration ?? player.duration ?? 0);
  const currentTime = tick?.currentTime ?? player.currentTime ?? 0;
  const bufferedPosition = tick?.bufferedPosition ?? player.bufferedPosition ?? 0;
  const videoTracks = useMemo(
    () => loaded?.availableVideoTracks ?? player.availableVideoTracks ?? [],
    [loaded?.availableVideoTracks, player],
  );
  const subtitleTracks = useMemo(
    () => loaded?.availableSubtitleTracks ?? player.availableSubtitleTracks ?? [],
    [loaded?.availableSubtitleTracks, player],
  );
  const playPercent = duration > 0 ? clamp((currentTime / duration) * 100, 0, 100) : 0;
  const bufferedPercent =
    duration > 0 && bufferedPosition > 0
      ? clamp((bufferedPosition / duration) * 100, 0, 100)
      : 0;

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

  const saveProgress = useCallback(
    (force = false) => {
      const currentItem = itemRef.current;
      if (!currentItem || duration <= 0) return;
      const position = currentTime;
      const last = lastSavedRef.current;
      if (
        !force &&
        last.position >= 0 &&
        Math.abs(position - last.position) < 3 &&
        Math.abs(duration - last.duration) < 0.5
      ) {
        return;
      }
      lastSavedRef.current = { position, duration };
      const next = {
        ...savedProgressRef.current,
        [currentItem.id]: {
          position,
          duration,
          updatedAt: Date.now(),
          completed: position >= duration - 1,
        },
      };
      savedProgressRef.current = next;
      void saveVideoProgress(next);
    },
    [currentTime, duration],
  );

  useEffect(() => {
    if (!item || !Number.isFinite(duration) || duration <= 0) return;
    if (!isPlaying) return;
    if (currentTime > 0) saveProgress(false);
  }, [currentTime, duration, isPlaying, item, saveProgress]);

  useEffect(() => {
    const restore = () => {
      const currentItem = itemRef.current;
      if (!currentItem || duration <= 0) return;
      const saved = savedProgressRef.current[currentItem.id];
      if (
        saved &&
        !saved.completed &&
        saved.position > 5 &&
        saved.position < duration - 3
      ) {
        safeSeek(player, Math.min(saved.position, duration - 1));
      }
      lastSavedRef.current = { position: -1, duration: 0 };
      if (!autoplayRef.current) return;
      safePlay(player);
    };
    const subscription = player.addListener("sourceLoad", restore);
    return () => subscription.remove();
  }, [duration, player]);

  useEffect(() => {
    setIsLive(!!player.isLive);
  }, [player, status, tick]);

  useEffect(() => {
    safeSetSpeed(player, settings.speed);
    safeSetLoop(player, settings.loop);
  }, [player, settings.loop, settings.speed]);

  useEffect(() => {
    try {
      const targetHeight = videoQualityHeight(settings.quality);
      if (!targetHeight || !qualityTracks.length) {
        safeSetMaxResolution(player, null);
        return;
      }
      const candidates = qualityTracks.filter(
        (track) => !!track.size?.height && track.size.height <= targetHeight,
      );
      safeSetMaxResolution(player, (candidates[0] ?? qualityTracks[0])?.size ?? null);
    } catch {
      /* adaptive quality is optional */
    }
  }, [player, qualityTracks, settings.quality]);

  useEffect(() => {
    try {
      if (settings.subtitlesEnabled && subtitleTracks.length) {
        safeSetSubtitle(player, subtitleTracks[0]);
        setSubtitleIndex(1);
      }
    } catch {
      /* captions are optional */
    }
  }, [player, settings.subtitlesEnabled, subtitleTracks]);

  useEffect(() => {
    if (error || status === "error") {
      setErrorNotice(
        error?.message
          ? `Playback was interrupted: ${error.message}`
          : "Playback was interrupted. Tap retry to reconnect this video.",
      );
    } else if (status === "readyToPlay") {
      setErrorNotice(null);
    }
  }, [error, status]);

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
      }
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [player, saveProgress, sleepEndsAt]);

  const saveProgressRef = useRef(saveProgress);
  useEffect(() => {
    saveProgressRef.current = saveProgress;
  }, [saveProgress]);
  useEffect(() => {
    return () => {
      saveProgressRef.current(true);
    };
    // Save once when the player screen is left; active item is held in a ref.
  }, []);

  const togglePlayback = () => {
    try {
      if (player.playing) safePause(player);
      else safePlay(player);
    } catch {}
  };

  const seekToFraction = useCallback(
    (fraction: number) => {
      if (duration > 0) {
        safeSeek(player, clamp(fraction * duration, 0, duration));
      }
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

  const cycleQuality = () => {
    if (!qualityTracks.length) return;
    const next = (qualityIndex + 1) % (qualityTracks.length + 1);
    setQualityIndex(next);
    safeSetMaxResolution(player, next === 0 ? null : qualityTracks[next - 1]?.size ?? null);
  };

  const cycleSubtitles = () => {
    if (!subtitleTracks.length) return;
    const next = (subtitleIndex + 1) % (subtitleTracks.length + 1);
    setSubtitleIndex(next);
    safeSetSubtitle(player, next === 0 ? null : subtitleTracks[next - 1]);
  };

  const shareToCommunity = () => {
    if (!item) return;
    saveProgress(true);
    router.push({
      pathname: "/community",
      params: {
        video: JSON.stringify({
          id: item.id,
          title: item.title,
          uri: item.uri,
          source: item.source,
        }),
      },
    });
  };

  const retry = () => {
    saveProgress(true);
    setErrorNotice(null);
    setRetryKey((value) => value + 1);
  };

  const qualityLabel =
    qualityIndex === 0 ? "AUTO" : `${qualityTracks[qualityIndex - 1]?.size?.height ?? "?"}p`;
  const subtitleLabel =
    subtitleIndex === 0
      ? settings.subtitlesEnabled ? "CC ON" : "CC OFF"
      : subtitleTracks[subtitleIndex - 1]
        ? subtitleLabelFor(subtitleTracks[subtitleIndex - 1])
        : "CC";

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={C.accent} size="large" />
        <Text style={styles.loadingText}>Opening WALLORA Player…</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.screen}>
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </Pressable>
        </View>
        <EmptyState
          icon="film-outline"
          title="Video not found"
          message="This item is no longer in your library. Add it again to keep watching."
          actionLabel="Back to library"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Pressable
        style={FILL}
        onPress={() => setControlsVisible((value) => !value)}
        accessibilityRole="button"
        accessibilityLabel="Toggle player controls"
      >
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
          onPictureInPictureStart={() => setPipActive(true)}
          onPictureInPictureStop={() => setPipActive(false)}
        />
      </Pressable>

      <LinearGradient colors={["rgba(0,0,0,0.8)", "rgba(0,0,0,0)"]} style={styles.topGradient} pointerEvents="none" />
      <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.9)"]} style={styles.bottomGradient} pointerEvents="none" />

      {settings.showWatermark && !fullscreen && (
        <TvWatermark channelName={item.title} compact />
      )}

      {controlsVisible && !fullscreen && (
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={() => router.back()} style={styles.iconButton} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={styles.playerPill}>
              <Ionicons name="film-outline" size={10} color={C.bg} />
              <Text style={styles.playerPillText}>WALLORA PLAYER</Text>
              {isLive && <Text style={styles.liveText}>LIVE</Text>}
            </View>
            <Text style={styles.channelTitle} numberOfLines={1}>
              {item.title}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push({ pathname: "/video-player/settings", params: { id: item.id } })}
            style={styles.iconButton}
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={19} color={C.white} />
          </Pressable>
        </View>
      )}

      {!fullscreen && (
        <View style={styles.statusWrap} pointerEvents="box-none">
          {status === "loading" && !errorNotice ? (
            <View style={styles.centerCard}>
              <ActivityIndicator color={C.accent} size="large" />
              <Text style={styles.centerTitle}>Loading video…</Text>
            </View>
          ) : errorNotice ? (
            <View style={styles.centerCard}>
              <Ionicons name="wifi-outline" size={23} color={C.error} />
              <Text style={styles.centerTitle}>Playback needs a retry</Text>
              <Text style={styles.centerDetail}>{errorNotice}</Text>
              <Pressable onPress={retry} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Retry now</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      )}

      {controlsVisible && !fullscreen && (
        <View style={[styles.chipRow, { top: insets.top + 92 }]}>
          <Pressable onPress={cycleQuality} style={styles.chip}>
            <Ionicons name="resize-outline" size={11} color={C.textSoft} />
            <Text style={styles.chipText}>{qualityLabel}</Text>
          </Pressable>
          <Pressable onPress={cycleSubtitles} style={styles.chip}>
            <Ionicons name="logo-closed-captioning" size={12} color={C.textSoft} />
            <Text style={styles.chipText}>{subtitleLabel}</Text>
          </Pressable>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{formatRate(playbackRate || settings.speed)}</Text>
          </View>
          {settings.loop && (
            <View style={styles.chip}>
              <Ionicons name="repeat" size={11} color={C.accent} />
              <Text style={styles.chipText}>LOOP</Text>
            </View>
          )}
        </View>
      )}

      {controlsVisible && !fullscreen && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
          <View style={styles.nowPlaying}>
            <Text style={styles.nowPlayingLabel}>NOW PLAYING</Text>
            <Text style={styles.nowPlayingTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.nowPlayingGroup}>
              {item.source === "local"
                ? "On this device"
                : item.source === "url"
                  ? "Network stream"
                  : "WALLORA demo stream"}
              {" · "}
              {formatTime(currentTime)} / {duration > 0 ? formatTime(duration) : "LIVE"}
            </Text>
          </View>

          <View style={styles.scrubWrap} onLayout={(event) => setScrubWidth(event.nativeEvent.layout.width)}>
            <View
              style={styles.scrubArea}
              hitSlop={{ top: 14, bottom: 14, left: 0, right: 0 }}
              {...scrub.panHandlers}
            >
              <View style={styles.scrubTrack}>
                <View style={[styles.scrubBuffered, { width: `${bufferedPercent}%` }]} />
                <View style={[styles.scrubFill, { width: `${playPercent}%` }]} />
              </View>
              <View style={[styles.scrubThumb, { left: `${playPercent}%` }]} />
            </View>
          </View>

          <View style={styles.transportRow}>
            <Pressable onPress={retry} style={styles.secondaryIconButton} hitSlop={8}>
              <Ionicons name="refresh-outline" size={17} color={C.white} />
            </Pressable>
            <Pressable onPress={togglePlayback} style={styles.playButton}>
              <Ionicons name={isPlaying ? "pause" : "play"} size={19} color={C.bg} />
            </Pressable>
            <Pressable
              onPress={() => void videoRef.current?.startPictureInPicture().catch(() => {})}
              style={styles.secondaryIconButton}
              disabled={!pipSupported}
            >
              <Ionicons name="contract-outline" size={17} color={pipSupported ? C.white : C.mutedDark} />
            </Pressable>
            <Pressable
              onPress={() => void videoRef.current?.enterFullscreen().catch(() => {})}
              style={styles.secondaryIconButton}
            >
              <Ionicons name="expand-outline" size={17} color={C.white} />
            </Pressable>
          </View>

          <Pressable onPress={shareToCommunity} style={styles.shareButton}>
            <Ionicons name="people-outline" size={16} color={C.bg} />
            <Text style={styles.shareButtonText}>Share to community</Text>
            <Ionicons name="arrow-forward" size={14} color={C.bg} />
          </Pressable>

          {sleepEndsAt && (
            <Text style={styles.modeText}>Sleep timer · {formatTime(sleepRemaining)} remaining</Text>
          )}
          {(pipActive || fullscreen) && (
            <Text style={styles.modeText}>
              {fullscreen ? "Full-screen playback" : "Picture in picture"}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function subtitleLabelFor(track: SubtitleTrack) {
  return track.label || track.name || track.language || "CC";
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.black },
  centered: { alignItems: "center", justifyContent: "center" },
  loadingText: { color: C.textSoft, fontSize: 12, marginTop: 12 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 200 },
  bottomGradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: 320 },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    zIndex: 5,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  playerPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: R.pill,
    backgroundColor: C.accent,
  },
  playerPillText: { color: C.bg, fontSize: 8.5, fontWeight: "900", letterSpacing: 0.8 },
  liveText: { color: C.error, fontSize: 8.5, fontWeight: "900", marginLeft: 2 },
  channelTitle: {
    color: C.white,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 6,
    textShadowColor: "#000",
    textShadowRadius: 4,
  },
  statusWrap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  centerCard: {
    maxWidth: "78%",
    alignItems: "center",
    padding: 18,
    borderRadius: R.xl,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  centerTitle: { color: C.white, fontSize: 14, fontWeight: "900", marginTop: 9, textAlign: "center" },
  centerDetail: { color: C.textSoft, fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 5 },
  retryButton: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 9, borderRadius: R.pill, backgroundColor: C.accent },
  retryButtonText: { color: C.bg, fontSize: 11, fontWeight: "900" },
  chipRow: { position: "absolute", left: 14, right: 14, flexDirection: "row", gap: 7, zIndex: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: R.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  chipText: { color: C.textSoft, fontSize: 10, fontWeight: "800" },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, zIndex: 5 },
  nowPlaying: { marginBottom: 12 },
  nowPlayingLabel: { color: C.accent, fontSize: 9, fontWeight: "900", letterSpacing: 1.3 },
  nowPlayingTitle: {
    color: C.white,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 3,
    textShadowColor: "#000",
    textShadowRadius: 5,
  },
  nowPlayingGroup: { color: C.textSoft, fontSize: 10.5, marginTop: 3 },
  scrubWrap: { height: 24, justifyContent: "center", marginBottom: 8 },
  scrubArea: { height: 24, justifyContent: "center" },
  scrubTrack: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.22)" },
  scrubBuffered: { position: "absolute", left: 0, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.34)" },
  scrubFill: { position: "absolute", left: 0, height: 4, borderRadius: 2, backgroundColor: C.accent },
  scrubThumb: {
    position: "absolute",
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: C.accent,
    marginLeft: -5,
  },
  transportRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  playButton: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: C.accent },
  secondaryIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 13,
    minHeight: 42,
    borderRadius: R.pill,
    backgroundColor: C.accent,
  },
  shareButtonText: { color: C.bg, fontSize: 12, fontWeight: "900" },
  modeText: { color: C.muted, fontSize: 10, textAlign: "center", marginTop: 7 },
});
