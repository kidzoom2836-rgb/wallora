import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  type VideoTrack,
} from "expo-video";

import { EmptyState } from "../../components/ui/States";
import { TvWatermark } from "../../components/media/TvWatermark";
import { TvSignalSearching } from "../../components/media/TvSignalSearching";
import {
  hasAcceptedTvTerms,
  TvWelcomeModal,
} from "../../components/media/TvWelcomeModal";
import { C, R } from "../../lib/theme";
import {
  getFavoriteChannelIds,
  groupLabel,
  loadPlaylist,
  toggleFavoriteChannel,
  uniqueChannelId,
  type IptvChannel,
} from "../../lib/iptv";
import { recordWatch } from "../../lib/channelAnalytics";
import {
  getTvSettings,
  qualityHeight,
  DEFAULT_TV_SETTINGS,
  type TvSettings,
} from "../../lib/tvSettings";

const FILL = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const SPEEDS = [1, 1.25, 1.5, 2];
const MAX_RECONNECTS = 8;

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
function safeSetSpeed(player: VideoPlayer, rate: number) {
  try {
    player.playbackRate = rate;
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

function reconnectUrl(url: string, attempt: number): string {
  if (attempt <= 0) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_wallora_reconnect=${attempt}&_=${Date.now()}`;
}

function buildSource(channel: IptvChannel, attempt: number): VideoSource {
  const uri = reconnectUrl(channel.url, attempt);
  return {
    uri,
    ...(/m3u8/i.test(uri) ? ({ contentType: "hls" as const } as const) : {}),
    metadata: {
      title: channel.name,
      artist: "WALLORA Live TV",
    },
  };
}

export default function LiveTvPlayerScreen() {
  const params = useLocalSearchParams<{ channel?: string }>();
  const insets = useSafeAreaInsets();
  const [channel, setChannel] = useState<IptvChannel | null>(null);
  const [loadingGuide, setLoadingGuide] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [settings, setSettings] = useState<TvSettings>(DEFAULT_TV_SETTINGS);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectFailed, setReconnectFailed] = useState(false);
  const [reconnectReason, setReconnectReason] = useState("Reconnecting…");
  const [videoTracks, setVideoTracks] = useState<VideoTrack[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [qualityIndex, setQualityIndex] = useState(0);
  const [subtitleIndex, setSubtitleIndex] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const videoRef = useRef<VideoView>(null);
  const attemptRef = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProgressAt = useRef(Date.now());
  const lastGoodAt = useRef(Date.now());
  const userPaused = useRef(false);

  const pipSupported = useMemo(() => isPictureInPictureSupported(), []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      loadPlaylist(),
      hasAcceptedTvTerms(),
      getTvSettings(),
      getFavoriteChannelIds(),
    ])
      .then(([playlist, accepted, tvSettings, savedFavorites]) => {
        if (!alive) return;
        const requested = params.channel;
        const found =
          playlist.channels.find(
            (item) => uniqueChannelId(item) === requested,
          ) ?? playlist.channels[0] ?? null;
        setChannel(found);
        setTermsAccepted(accepted);
        setShowWelcome(!accepted);
        setSettings(tvSettings);
        setFavorites(savedFavorites);
      })
      .catch(() => {
        if (alive) setShowWelcome(true);
      })
      .finally(() => {
        if (alive) setLoadingGuide(false);
      });
    return () => {
      alive = false;
    };
  }, [params.channel]);

  const channelId = channel ? uniqueChannelId(channel) : "";
  const source = useMemo(
    () => (channel ? buildSource(channel, attempt) : { uri: "" }),
    [channel, attempt],
  );

  const player = useVideoPlayer(source, (instance) => {
    instance.staysActiveInBackground = true;
    instance.showNowPlayingNotification = false;
    instance.loop = false;
    instance.timeUpdateEventInterval = 1;
  });

  const { status, error } = useEvent(player, "statusChange", {
    status: player.status,
    error: undefined,
  });
  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });
  const { currentTime } = useEvent(player, "timeUpdate", {
    currentTime: player.currentTime,
    currentLiveTimestamp: player.currentLiveTimestamp,
    currentOffsetFromLive: player.currentOffsetFromLive,
    bufferedPosition: player.bufferedPosition,
  });

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  const applyNextAttempt = useCallback(() => {
    clearReconnectTimer();
    const next = attemptRef.current + 1;
    if (next > MAX_RECONNECTS) {
      setReconnectFailed(true);
      setReconnecting(false);
      return;
    }
    attemptRef.current = next;
    setAttempt(next);
    setReconnectFailed(false);
    setReconnecting(false);
    lastProgressAt.current = Date.now();
    lastGoodAt.current = Date.now();
    userPaused.current = false;
    safePlay(player);
  }, [clearReconnectTimer, player]);

  const scheduleReconnect = useCallback(
    (reason: string) => {
      if (reconnectTimer.current) return;
      if (attemptRef.current >= MAX_RECONNECTS) {
        setReconnectFailed(true);
        setReconnecting(false);
        return;
      }
      const next = attemptRef.current + 1;
      const delay = Math.min(1000 * 2 ** (next - 1), 8000);
      setReconnectReason(reason);
      setReconnecting(true);
      reconnectTimer.current = setTimeout(() => {
        reconnectTimer.current = null;
        applyNextAttempt();
      }, delay);
    },
    [applyNextAttempt],
  );

  useEffect(() => {
    attemptRef.current = 0;
    setAttempt(0);
    setReconnecting(false);
    setReconnectFailed(false);
    setQualityIndex(0);
    setSubtitleIndex(0);
    setSpeedIndex(0);
    lastProgressAt.current = Date.now();
    lastGoodAt.current = Date.now();
    clearReconnectTimer();
  }, [channelId, clearReconnectTimer]);

  useEffect(() => {
    if (status === "error" || !!error) {
      scheduleReconnect(
        error?.message ? `Stream interrupted: ${error.message}` : "Stream interrupted",
      );
    }
    if (status === "readyToPlay" || isPlaying) {
      lastGoodAt.current = Date.now();
      setReconnecting(false);
      setReconnectFailed(false);
    }
  }, [error, isPlaying, scheduleReconnect, status]);

  useEffect(() => {
    if (currentTime > 0) lastProgressAt.current = Date.now();
  }, [currentTime]);

  useEffect(() => {
    if (!channel || !termsAccepted) return;
    const timer = setInterval(() => {
      const now = Date.now();
      const stalledWhilePlaying =
        isPlaying && now - lastProgressAt.current > 30_000;
      const stuckWhileLoading =
        !userPaused.current &&
        !isPlaying &&
        (status === "loading" || status === "readyToPlay") &&
        now - lastGoodAt.current > 25_000;
      if (stalledWhilePlaying) scheduleReconnect("Playback stalled — reconnecting");
      else if (stuckWhileLoading) scheduleReconnect("Stream is taking too long — reconnecting");
    }, 5000);
    return () => clearInterval(timer);
  }, [channel, isPlaying, scheduleReconnect, status, termsAccepted]);

  useEffect(() => {
    if (!channel || !termsAccepted || (!settings.autoplay && attempt === 0)) return;
    safePlay(player);
  }, [attempt, channel, player, settings.autoplay, termsAccepted]);

  useEffect(() => {
    if (!termsAccepted) {
      safePause(player);
    }
  }, [player, termsAccepted]);

  const refreshTracks = useCallback(() => {
    try {
      setVideoTracks(player.availableVideoTracks ?? []);
      setSubtitleTracks(player.availableSubtitleTracks ?? []);
    } catch {
      setVideoTracks([]);
      setSubtitleTracks([]);
    }
  }, [player]);

  useEffect(() => {
    refreshTracks();
    const listeners = [
      player.addListener("sourceLoad", refreshTracks),
      player.addListener("videoTrackChange", refreshTracks),
      player.addListener("availableSubtitleTracksChange", refreshTracks),
    ];
    return () => listeners.forEach((listener) => listener.remove());
  }, [player, refreshTracks]);

  useEffect(() => {
    const targetHeight = settings.lowDataMode ? 480 : qualityHeight(settings.quality);
    try {
      if (!targetHeight || !videoTracks.length) {
        safeSetMaxResolution(player, null);
        return;
      }
      const candidates = videoTracks
        .filter((track) => !!track.size?.height && track.size.height <= targetHeight)
        .sort((a, b) => (b.size?.height ?? 0) - (a.size?.height ?? 0));
      const chosen = candidates[0] ?? videoTracks[0];
      safeSetMaxResolution(player, chosen?.size ?? null);
    } catch {
      /* resolution selection is a best-effort optimisation */
    }
  }, [player, settings.lowDataMode, settings.quality, videoTracks]);

  useEffect(() => {
    try {
      if (settings.subtitlesDefault && subtitleTracks.length && !player.subtitleTrack) {
        safeSetSubtitle(player, subtitleTracks[0]);
        setSubtitleIndex(1);
      }
    } catch {
      /* subtitles are optional */
    }
  }, [player, settings.subtitlesDefault, subtitleTracks]);

  useEffect(() => {
    safeSetSpeed(player, SPEEDS[speedIndex]);
  }, [player, speedIndex]);

  useEffect(() => {
    if (!channelId || !termsAccepted || !isPlaying) return;
    let seconds = 0;
    const timer = setInterval(() => {
      seconds += 5;
      if (seconds >= 30) {
        recordWatch(channelId, seconds).catch(() => {});
        seconds = 0;
      }
    }, 5000);
    return () => {
      clearInterval(timer);
      if (seconds) recordWatch(channelId, seconds).catch(() => {});
    };
  }, [channelId, isPlaying, termsAccepted]);

  useEffect(() => {
    return () => {
      clearReconnectTimer();
    };
  }, [clearReconnectTimer]);

  const togglePlayback = () => {
    if (!termsAccepted) {
      setShowWelcome(true);
      return;
    }
    if (isPlaying) {
      userPaused.current = true;
      safePause(player);
    } else {
      userPaused.current = false;
      safePlay(player);
    }
  };

  const toggleFavorite = async () => {
    if (!channelId) return;
    const next = await toggleFavoriteChannel(channelId);
    setFavorites(next);
  };

  const cycleQuality = () => {
    if (!videoTracks.length) return;
    const next = (qualityIndex + 1) % (videoTracks.length + 1);
    setQualityIndex(next);
    safeSetMaxResolution(player, next === 0 ? null : videoTracks[next - 1]?.size ?? null);
  };

  const cycleSubtitles = () => {
    if (!subtitleTracks.length) return;
    const next = (subtitleIndex + 1) % (subtitleTracks.length + 1);
    setSubtitleIndex(next);
    safeSetSubtitle(player, next === 0 ? null : subtitleTracks[next - 1]);
  };

  const cycleSpeed = () => {
    setSpeedIndex((current) => (current + 1) % SPEEDS.length);
  };

  const shareToCommunity = () => {
    if (!channel) return;
    router.push({
      pathname: "/community",
      params: { recommend: channelId },
    });
  };

  const qualityLabel =
    qualityIndex === 0
      ? settings.lowDataMode
        ? "480p DATA"
        : "AUTO"
      : `${videoTracks[qualityIndex - 1]?.size?.height ?? "?"}p`;
  const subtitleLabel =
    subtitleIndex === 0 ? "CC OFF" : subtitleTracks[subtitleIndex - 1]?.label ?? "CC";
  const isFavorite = !!channelId && favorites.includes(channelId);

  if (loadingGuide) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <TvSignalSearching
          label="OPENING WALLORA TV"
          detail="Loading your secure channel guide…"
          compact
        />
      </View>
    );
  }

  if (!channel) {
    return (
      <View style={styles.screen}>
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </Pressable>
        </View>
        <EmptyState
          icon="tv-outline"
          title="No channels available"
          message="Refresh the guide or add a working playlist from TV settings."
          actionLabel="Open TV settings"
          onAction={() => router.replace("/live-tv/settings")}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Pressable
        style={FILL}
        onPress={() => setControlsVisible((visible) => !visible)}
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

      <LinearGradient
        colors={["rgba(0,0,0,0.78)", "rgba(0,0,0,0)"]}
        style={styles.topGradient}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.88)"]}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {settings.showWatermark && !fullscreen && (
        <TvWatermark channelName={channel.name} compact />
      )}

      {controlsVisible && !fullscreen && (
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={() => router.back()} style={styles.iconButton} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>WALLORA LIVE</Text>
            </View>
            <Text style={styles.channelTitle} numberOfLines={1}>
              {channel.name}
            </Text>
            <Text style={styles.channelGroup} numberOfLines={1}>
              {groupLabel(channel.group)}
            </Text>
          </View>
          <Pressable onPress={() => void toggleFavorite()} style={styles.iconButton} hitSlop={8}>
            <Ionicons
              name={isFavorite ? "star" : "star-outline"}
              size={19}
              color={isFavorite ? C.accent : C.white}
            />
          </Pressable>
          <Pressable
            onPress={() => router.push("/live-tv/settings")}
            style={styles.iconButton}
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={19} color={C.white} />
          </Pressable>
        </View>
      )}

      <View style={styles.statusWrap} pointerEvents="box-none">
        {!termsAccepted ? (
          <View style={styles.centerCard}>
            <Ionicons name="lock-closed-outline" size={26} color={C.accent} />
            <Text style={styles.centerTitle}>Accept WALLORA TV terms</Text>
            <Text style={styles.centerDetail}>
              Review the terms to start streaming inside the app.
            </Text>
          </View>
        ) : status === "loading" && !reconnecting ? (
          <View style={styles.centerCard}>
            <TvSignalSearching
              label="SEARCHING SIGNAL"
              detail="Your WALLORA TV player is locking onto this channel."
              channelName={channel.name}
              attempt={attempt}
              compact
            />
          </View>
        ) : reconnecting ? (
          <View style={styles.centerCard}>
            <TvSignalSearching
              label="RESCANNING SIGNAL"
              detail={reconnectReason}
              channelName={channel.name}
              attempt={attempt}
              compact
            />
          </View>
        ) : reconnectFailed ? (
          <View style={styles.centerCard}>
            <Ionicons name="wifi-outline" size={24} color={C.error} />
            <Text style={styles.centerTitle}>Stream needs a manual retry</Text>
            <Text style={styles.centerDetail}>
              The channel may be offline right now. Try reconnecting or choose another channel.
            </Text>
            <Pressable onPress={applyNextAttempt} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Reconnect now</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {controlsVisible && !fullscreen && (
        <View style={[styles.chipRow, { top: insets.top + 116 }]}>
          <Pressable onPress={cycleQuality} style={styles.chip}>
            <Ionicons name="resize-outline" size={11} color={C.textSoft} />
            <Text style={styles.chipText}>{qualityLabel}</Text>
          </Pressable>
          <Pressable onPress={cycleSpeed} style={styles.chip}>
            <Ionicons name="speedometer-outline" size={11} color={C.textSoft} />
            <Text style={styles.chipText}>{SPEEDS[speedIndex]}x</Text>
          </Pressable>
          <Pressable onPress={cycleSubtitles} style={styles.chip}>
            <Ionicons name="logo-closed-captioning" size={12} color={C.textSoft} />
            <Text style={styles.chipText} numberOfLines={1}>
              {subtitleLabel}
            </Text>
          </Pressable>
          {settings.lowDataMode && (
            <View style={styles.chip}>
              <Ionicons name="leaf-outline" size={11} color={C.success} />
              <Text style={styles.chipText}>1 Mbps</Text>
            </View>
          )}
        </View>
      )}

      {controlsVisible && !fullscreen && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
          <View style={styles.nowPlaying}>
            <Text style={styles.nowPlayingLabel}>NOW PLAYING</Text>
            <Text style={styles.nowPlayingTitle} numberOfLines={1}>
              {channel.name}
            </Text>
            <Text style={styles.nowPlayingGroup}>
              {groupLabel(channel.group)} · WALLORA TV
            </Text>
          </View>

          <View style={styles.transportRow}>
            <Pressable onPress={togglePlayback} style={styles.playButton}>
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={18}
                color={C.bg}
              />
            </Pressable>
            <Pressable onPress={() => applyNextAttempt()} style={styles.secondaryIconButton}>
              <Ionicons name="refresh-outline" size={17} color={C.white} />
            </Pressable>
            {pipSupported && (
              <Pressable
                onPress={() => void videoRef.current?.startPictureInPicture().catch(() => {})}
                style={styles.secondaryIconButton}
              >
                <Ionicons name="contract-outline" size={17} color={C.white} />
              </Pressable>
            )}
            <Pressable
              onPress={() => void videoRef.current?.enterFullscreen().catch(() => {})}
              style={styles.secondaryIconButton}
            >
              <Ionicons name="expand-outline" size={17} color={C.white} />
            </Pressable>
            <Pressable onPress={() => router.back()} style={styles.secondaryIconButton}>
              <Ionicons name="list-outline" size={17} color={C.white} />
            </Pressable>
          </View>

          <Pressable onPress={shareToCommunity} style={styles.shareButton}>
            <Ionicons name="people-outline" size={16} color={C.bg} />
            <Text style={styles.shareButtonText}>Share to community</Text>
            <Ionicons name="arrow-forward" size={14} color={C.bg} />
          </Pressable>

          {(pipActive || fullscreen) && (
            <Text style={styles.modeText}>
              {fullscreen ? "Full-screen playback" : "Picture in picture"}
            </Text>
          )}
        </View>
      )}

      <TvWelcomeModal
        visible={showWelcome}
        onAccept={() => {
          setTermsAccepted(true);
          setShowWelcome(false);
        }}
        onLater={() => setShowWelcome(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.black },
  centered: { alignItems: "center", justifyContent: "center" },
  loadingText: { color: C.textSoft, fontSize: 12, marginTop: 12 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 210 },
  bottomGradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: 300 },
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
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: R.pill,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FF4D4D" },
  livePillText: { color: C.white, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  channelTitle: {
    color: C.white,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 6,
    textShadowColor: "#000",
    textShadowRadius: 4,
  },
  channelGroup: { color: C.textSoft, fontSize: 10.5, marginTop: 2 },
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
    backgroundColor: "rgba(0,0,0,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  centerTitle: { color: C.white, fontSize: 14, fontWeight: "900", marginTop: 9, textAlign: "center" },
  centerDetail: {
    color: C.textSoft,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 5,
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: R.pill,
    backgroundColor: C.accent,
  },
  retryButtonText: { color: C.bg, fontSize: 11, fontWeight: "900" },
  chipRow: {
    position: "absolute",
    left: 14,
    right: 14,
    flexDirection: "row",
    gap: 7,
    zIndex: 4,
  },
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
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    zIndex: 5,
  },
  nowPlaying: { marginBottom: 14 },
  nowPlayingLabel: { color: C.accent, fontSize: 9, fontWeight: "900", letterSpacing: 1.3 },
  nowPlayingTitle: {
    color: C.white,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
    textShadowColor: "#000",
    textShadowRadius: 5,
  },
  nowPlayingGroup: { color: C.textSoft, fontSize: 11, marginTop: 3 },
  transportRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  playButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accent,
  },
  secondaryIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    minHeight: 42,
    borderRadius: R.pill,
    backgroundColor: C.accent,
  },
  shareButtonText: { color: C.bg, fontSize: 12, fontWeight: "900" },
  modeText: { color: C.muted, fontSize: 10, textAlign: "center", marginTop: 8 },
});
