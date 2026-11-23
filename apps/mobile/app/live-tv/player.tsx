import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEvent } from "expo";
import { BlurTargetView, BlurView } from "expo-blur";
import * as Brightness from "expo-brightness";
import { LinearGradient } from "expo-linear-gradient";
import { getNetworkStateAsync, NetworkStateType } from "expo-network";
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
import { PlayerGestures } from "../../components/media/PlayerGestures";
import { PlayerChannelDrawer } from "../../components/media/PlayerChannelDrawer";
import {
  PlayerToolsDrawer,
  type PlayerStats,
} from "../../components/media/PlayerToolsDrawer";
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
  saveTvSettings,
  qualityHeight,
  DEFAULT_TV_SETTINGS,
  SPEED_OPTIONS,
  type TvSettings,
} from "../../lib/tvSettings";
import {
  ASPECT_RATIO_LABELS,
  DEFAULT_PLAYER_SETTINGS,
  getPlayerSettings,
  savePlayerSettings,
  type PlayerAspectRatio,
  type PlayerSettings,
} from "../../lib/playerSettings";
import {
  addBackupUrl,
  buildSourceVariants,
  getBackupUrls,
} from "../../lib/playerSources";

const FILL = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const MAX_RECONNECTS = 8;
const CONTROLS_HIDE_MS = 3000;

const CONTENT_FIT: Record<PlayerAspectRatio, "contain" | "cover" | "fill"> = {
  fit: "contain",
  fill: "cover",
  stretch: "fill",
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
function safeSetBackgroundAudio(player: VideoPlayer, enabled: boolean) {
  try {
    player.staysActiveInBackground = enabled;
    player.showNowPlayingNotification = enabled;
  } catch {}
}
function safeSetVolume(player: VideoPlayer, value: number) {
  try {
    player.volume = Math.min(1, Math.max(0, value));
  } catch {}
}
function safeSeekBy(player: VideoPlayer, seconds: number) {
  try {
    player.seekBy(seconds);
  } catch {}
}
function safeJumpToLive(player: VideoPlayer) {
  try {
    player.currentTime = player.bufferedPosition || player.currentTime;
  } catch {}
}
function safeSetCurrentTime(player: VideoPlayer, seconds: number) {
  try {
    player.currentTime = Math.max(0, seconds);
  } catch {}
}

function reconnectUrl(url: string, attempt: number): string {
  if (attempt <= 0) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_wallora_reconnect=${attempt}&_=${Date.now()}`;
}

function buildSourceUrl(url: string, title: string, attempt: number): VideoSource {
  const uri = reconnectUrl(url, attempt);
  return {
    uri,
    ...(/m3u8/i.test(uri) ? ({ contentType: "hls" as const } as const) : {}),
    metadata: {
      title,
      artist: "WALLORA Live TV",
    },
  };
}

export default function LiveTvPlayerScreen() {
  const params = useLocalSearchParams<{ channel?: string }>();
  const insets = useSafeAreaInsets();
  const [channels, setChannels] = useState<IptvChannel[]>([]);
  const [channel, setChannel] = useState<IptvChannel | null>(null);
  const [loadingGuide, setLoadingGuide] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [settings, setSettings] = useState<TvSettings>(DEFAULT_TV_SETTINGS);
  const [playerSettings, setPlayerSettings] = useState<PlayerSettings>(
    DEFAULT_PLAYER_SETTINGS,
  );
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
  const [wakeNonce, setWakeNonce] = useState(0);
  const [drawer, setDrawer] = useState<"channels" | "tools" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [boosting, setBoosting] = useState(false);
  const [backups, setBackups] = useState<string[]>([]);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [sleepDeadline, setSleepDeadline] = useState<number | null>(null);
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number | null>(null);
  const [networkType, setNetworkType] = useState<NetworkStateType>(
    NetworkStateType.UNKNOWN,
  );
  const [scrubWidth, setScrubWidth] = useState(1);

  const videoRef = useRef<VideoView>(null);
  const blurTargetRef = useRef<ComponentRef<typeof View> | null>(null);
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
      getPlayerSettings(),
    ])
      .then(([playlist, accepted, tvSettings, savedFavorites, savedPlayer]) => {
        if (!alive) return;
        const requested = params.channel;
        const found =
          playlist.channels.find(
            (item) => uniqueChannelId(item) === requested,
          ) ?? playlist.channels[0] ?? null;
        setChannels(playlist.channels);
        setChannel(found);
        setTermsAccepted(accepted);
        setShowWelcome(!accepted);
        setSettings(tvSettings);
        setFavorites(savedFavorites);
        setPlayerSettings(savedPlayer);
        if (found) {
          getBackupUrls(uniqueChannelId(found))
            .then((urls) => alive && setBackups(urls))
            .catch(() => {});
        }
      })
      .catch(() => {
        if (alive) setShowWelcome(true);
      })
      .finally(() => {
        if (alive) setLoadingGuide(false);
      });
    getNetworkStateAsync()
      .then((state) => alive && setNetworkType(state.type ?? NetworkStateType.UNKNOWN))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [params.channel]);

  const channelId = channel ? uniqueChannelId(channel) : "";
  const sourceVariants = useMemo(
    () => buildSourceVariants(channel, backups),
    [channel, backups],
  );
  const activeSource = sourceVariants[activeSourceIndex] ?? sourceVariants[0];
  const source = useMemo(
    () =>
      activeSource
        ? buildSourceUrl(activeSource.url, channel?.name ?? "WALLORA TV", attempt)
        : { uri: "" },
    [activeSource, attempt, channel?.name],
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
  const { currentTime, bufferedPosition, currentOffsetFromLive } = useEvent(
    player,
    "timeUpdate",
    {
      currentTime: player.currentTime,
      currentLiveTimestamp: player.currentLiveTimestamp,
      currentOffsetFromLive: player.currentOffsetFromLive,
      bufferedPosition: player.bufferedPosition,
    },
  );

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
      if (!settings.autoReconnect || attemptRef.current >= MAX_RECONNECTS) {
        setReconnectReason(settings.autoReconnect ? reason : "Auto-reconnect is off");
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
    [applyNextAttempt, settings.autoReconnect],
  );

  useEffect(() => {
    attemptRef.current = 0;
    setAttempt(0);
    setReconnecting(false);
    setReconnectFailed(false);
    setQualityIndex(0);
    setSubtitleIndex(0);
    setActiveSourceIndex(0);
    setNotice(null);
    const defaultSpeedIndex = SPEED_OPTIONS.findIndex(
      (speed) => speed === settings.defaultSpeed,
    );
    setSpeedIndex(defaultSpeedIndex < 0 ? 0 : defaultSpeedIndex);
    lastProgressAt.current = Date.now();
    lastGoodAt.current = Date.now();
    clearReconnectTimer();
  }, [channelId, clearReconnectTimer, settings.defaultSpeed]);

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
    safeSetBackgroundAudio(
      player,
      settings.backgroundAudio || playerSettings.audioOnly,
    );
  }, [player, playerSettings.audioOnly, settings.backgroundAudio]);

  useEffect(() => {
    safeSetVolume(player, playerSettings.volume);
  }, [player, playerSettings.volume]);

  useEffect(() => {
    safeSetSpeed(player, boosting ? 2 : SPEED_OPTIONS[speedIndex]);
  }, [boosting, player, speedIndex]);

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
    let alive = true;
    Brightness.isAvailableAsync()
      .then((available) => {
        if (!alive || !available) return;
        return Brightness.getBrightnessAsync()
          .then((value) => {
            if (alive && Number.isFinite(value)) {
              setPlayerSettings((current) => ({ ...current, brightness: value }));
            }
          })
          .catch(() => {});
      })
      .catch(() => {});
    return () => {
      alive = false;
      Brightness.restoreSystemBrightnessAsync().catch(() => {});
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      Brightness.isAvailableAsync()
        .then((available) => {
          if (available && !cancelled) {
            return Brightness.setBrightnessAsync(playerSettings.brightness);
          }
          return undefined;
        })
        .catch(() => {});
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [playerSettings.brightness]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void savePlayerSettings(playerSettings).catch(() => {});
    }, 450);
    return () => clearTimeout(timer);
  }, [playerSettings]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2800);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!controlsVisible || drawer || !isPlaying || !termsAccepted) return;
    const timer = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
    return () => clearTimeout(timer);
  }, [controlsVisible, drawer, isPlaying, termsAccepted, wakeNonce]);

  useEffect(() => {
    if (sleepDeadline === null) {
      setSleepRemainingSec(null);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, (sleepDeadline - Date.now()) / 1000);
      setSleepRemainingSec(remaining);
      if (remaining <= 0) {
        userPaused.current = true;
        safePause(player);
        setSleepDeadline(null);
        setSleepMinutes(null);
        setNotice("Sleep timer ended — playback paused");
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [player, sleepDeadline]);

  useEffect(() => {
    return () => {
      clearReconnectTimer();
    };
  }, [clearReconnectTimer]);

  const wake = useCallback(() => {
    setControlsVisible(true);
    setWakeNonce((current) => current + 1);
  }, []);

  const togglePlayback = () => {
    wake();
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
    wake();
    const next = await toggleFavoriteChannel(channelId);
    setFavorites(next);
  };

  const cycleQuality = () => {
    if (!videoTracks.length) return;
    wake();
    const next = (qualityIndex + 1) % (videoTracks.length + 1);
    setQualityIndex(next);
    safeSetMaxResolution(player, next === 0 ? null : videoTracks[next - 1]?.size ?? null);
  };

  const cycleSubtitles = () => {
    if (!subtitleTracks.length) return;
    wake();
    const next = (subtitleIndex + 1) % (subtitleTracks.length + 1);
    setSubtitleIndex(next);
    safeSetSubtitle(player, next === 0 ? null : subtitleTracks[next - 1]);
  };

  const cycleSpeed = () => {
    wake();
    setSpeedIndex((current) => (current + 1) % SPEED_OPTIONS.length);
  };

  const shareToCommunity = () => {
    if (!channel) return;
    wake();
    router.push({
      pathname: "/community",
      params: { recommend: channelId },
    });
  };

  const handleBrightness = (value: number) => {
    wake();
    setPlayerSettings((current) => ({
      ...current,
      brightness: Math.min(1, Math.max(0, value)),
    }));
  };

  const handleVolume = (value: number) => {
    wake();
    setPlayerSettings((current) => ({
      ...current,
      volume: Math.min(1, Math.max(0, value)),
    }));
  };

  const handleSeek = (seconds: number) => {
    wake();
    if (!termsAccepted) {
      setShowWelcome(true);
      return;
    }
    safeSeekBy(player, seconds);
    setNotice(seconds > 0 ? "Jumped forward 10s" : "Rewound 10s");
  };

  const handleBoostStart = () => {
    wake();
    setBoosting(true);
  };

  const handleBoostEnd = () => {
    setBoosting(false);
  };

  const switchChannel = (direction: -1 | 1) => {
    if (!channels.length || !channel) return;
    const currentIndex = channels.findIndex(
      (item) => uniqueChannelId(item) === channelId,
    );
    const nextIndex =
      (currentIndex + direction + channels.length) % channels.length;
    const next = channels[nextIndex];
    if (!next || uniqueChannelId(next) === channelId) return;
    setChannel(next);
    setDrawer(null);
    setNotice(`${direction > 0 ? "Next" : "Previous"}: ${next.name}`);
  };

  const handleSelectSource = (index: number) => {
    if (index === activeSourceIndex) return;
    attemptRef.current = 0;
    setAttempt(0);
    setActiveSourceIndex(index);
    setReconnectFailed(false);
    setReconnecting(true);
    setReconnectReason("Switching server…");
    lastGoodAt.current = Date.now();
    lastProgressAt.current = Date.now();
    wake();
    setDrawer(null);
    setNotice(`Switching to ${sourceVariants[index]?.label ?? "backup server"}`);
  };

  const handleSuggestBackup = async (url: string) => {
    if (!channelId) throw new Error("Open a channel first.");
    const next = await addBackupUrl(channelId, url);
    setBackups(next);
    setNotice("Backup link saved on this device");
  };

  const handleSetSleepTimer = (minutes: number | null) => {
    setSleepMinutes(minutes);
    setSleepDeadline(minutes ? Date.now() + minutes * 60_000 : null);
    setNotice(minutes ? `Sleep timer set for ${minutes} minutes` : "Sleep timer off");
  };

  const updatePlayerSetting = (patch: Partial<PlayerSettings>) => {
    setPlayerSettings((current) => ({ ...current, ...patch }));
    wake();
  };

  const toggleAudioOnly = () => {
    const next = !playerSettings.audioOnly;
    updatePlayerSetting({ audioOnly: next });
    setNotice(next ? "Audio-only mode" : "Video restored");
  };

  const toggleNightMode = () => {
    const next = !playerSettings.nightMode;
    updatePlayerSetting({ nightMode: next });
    setNotice(next ? "Night mode" : "Normal brightness");
  };

  const toggleBackgroundAudio = () => {
    const next = !settings.backgroundAudio;
    setSettings((current) => ({ ...current, backgroundAudio: next }));
    void saveTvSettings({ backgroundAudio: next }).catch(() => {});
    setNotice(next ? "Background audio on" : "Background audio off");
  };

  const toggleTouchLock = () => {
    const next = !playerSettings.touchLocked;
    updatePlayerSetting({ touchLocked: next });
    setNotice(next ? "Player locked — tap the lock icon to unlock" : "Player unlocked");
  };

  const toggleZapping = () => {
    const next = !playerSettings.zappingEnabled;
    updatePlayerSetting({ zappingEnabled: next });
    setNotice(next ? "Swipe up or down to zap channels" : "Channel zapping off");
  };

  const cycleAspectRatio = () => {
    const ratios: PlayerAspectRatio[] = ["fit", "fill", "stretch"];
    const currentIndex = ratios.indexOf(playerSettings.aspectRatio);
    const next = ratios[(currentIndex + 1) % ratios.length];
    updatePlayerSetting({ aspectRatio: next });
    setNotice(`Aspect ratio: ${ASPECT_RATIO_LABELS[next]}`);
  };

  const handleJumpToLive = () => {
    wake();
    safeJumpToLive(player);
    setNotice("Back to live");
  };

  const handleScrub = (event: GestureResponderEvent) => {
    wake();
    if (!termsAccepted || bufferedPosition <= 0) return;
    const ratio = Math.min(
      1,
      Math.max(0, event.nativeEvent.locationX / Math.max(1, scrubWidth)),
    );
    const windowStart = Math.max(0, bufferedPosition - 300);
    const target = windowStart + ratio * (bufferedPosition - windowStart);
    safeSetCurrentTime(player, target);
    setNotice(ratio > 0.97 ? "Back to live" : `DVR: -${Math.max(1, Math.round(bufferedPosition - target))}s`);
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
  const liveDelaySec = Math.max(0, Math.round(currentOffsetFromLive || 0));
  const bufferedSec = Math.max(0, Math.round(bufferedPosition - currentTime));
  const resolutionLabel =
    qualityIndex === 0
      ? settings.lowDataMode
        ? "480p"
        : "AUTO"
      : `${videoTracks[qualityIndex - 1]?.size?.height ?? "?"}p`;
  const networkLabel =
    networkType === NetworkStateType.WIFI
      ? "Wi-Fi"
      : networkType === NetworkStateType.CELLULAR
        ? "Mobile"
        : networkType === NetworkStateType.ETHERNET
          ? "LAN"
          : "Unknown";
  const playerStats: PlayerStats = {
    resolution: resolutionLabel,
    bufferedSec,
    liveDelaySec,
    status: reconnecting
      ? "Reconnecting"
      : reconnectFailed
        ? "Signal lost"
        : status === "readyToPlay" || isPlaying
          ? "Playing"
          : status === "loading"
            ? "Loading"
            : "Idle",
    sourceLabel: activeSource?.label ?? "Primary",
    network: networkLabel,
  };
  const liveProgress = Math.max(
    0.04,
    Math.min(1, 1 - liveDelaySec / 300),
  );
  const nowLabel = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const nextLabel = new Date(Date.now() + 30 * 60_000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

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
      <PlayerGestures
        enabled={termsAccepted && !playerSettings.touchLocked && !fullscreen && !drawer}
        zappingEnabled={playerSettings.zappingEnabled}
        brightness={playerSettings.brightness}
        volume={playerSettings.volume}
        onBrightness={handleBrightness}
        onVolume={handleVolume}
        onSeek={handleSeek}
        onBoostStart={handleBoostStart}
        onBoostEnd={handleBoostEnd}
        onZap={switchChannel}
        onTap={wake}
      >
        <BlurTargetView ref={blurTargetRef} style={FILL}>
          <VideoView
            ref={videoRef}
            player={player}
            pointerEvents="none"
            style={[FILL, playerSettings.audioOnly && styles.hiddenVideo]}
            contentFit={CONTENT_FIT[playerSettings.aspectRatio]}
            nativeControls={false}
            allowsPictureInPicture={pipSupported}
            fullscreenOptions={{ enable: true, orientation: "landscape" }}
            onFullscreenEnter={() => setFullscreen(true)}
            onFullscreenExit={() => setFullscreen(false)}
            onPictureInPictureStart={() => setPipActive(true)}
            onPictureInPictureStop={() => setPipActive(false)}
          />
          {playerSettings.audioOnly && (
            <View pointerEvents="none" style={styles.audioOnlyOverlay}>
              <Ionicons name="musical-notes" size={34} color={C.accent} />
              <Text style={styles.audioOnlyTitle}>Audio only</Text>
              <Text style={styles.audioOnlyDetail}>Video hidden · controls still available</Text>
            </View>
          )}
          {playerSettings.nightMode && !playerSettings.audioOnly && (
            <View pointerEvents="none" style={styles.nightOverlay} />
          )}
        </BlurTargetView>

        <LinearGradient
          colors={["rgba(0,0,0,0.72)", "rgba(0,0,0,0)"]}
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
          <View
            pointerEvents="box-none"
            style={[styles.topBar, { paddingTop: insets.top + 10 }]}
          >
            <BlurView
              blurTarget={blurTargetRef}
              blurMethod="dimezisBlurViewSdk31Plus"
              intensity={78}
              tint="dark"
              style={styles.glassPanel}
            >
              <Pressable onPress={() => router.back()} style={styles.iconButton} hitSlop={8}>
                <Ionicons name="arrow-back" size={19} color={C.white} />
              </Pressable>
              {pipSupported && (
                <Pressable
                  onPress={() => void videoRef.current?.startPictureInPicture().catch(() => {})}
                  style={styles.iconButton}
                  hitSlop={8}
                >
                  <Ionicons name="contract-outline" size={17} color={C.white} />
                </Pressable>
              )}
              <View style={styles.hudChannelBlock}>
                <View style={styles.hudBadgeRow}>
                  <View style={[styles.livePill, liveDelaySec > 10 && styles.behindPill]}>
                    <View style={styles.liveDot} />
                    <Text style={styles.livePillText}>
                      {liveDelaySec > 10 ? `-${liveDelaySec}s BEHIND` : "LIVE"}
                    </Text>
                  </View>
                  <Text style={styles.hudMeta}>
                    {resolutionLabel} · {networkLabel}
                  </Text>
                </View>
                <Text style={styles.channelTitle} numberOfLines={1}>
                  {channel.name}
                </Text>
                <Text style={styles.channelGroup} numberOfLines={1}>
                  EPG {nowLabel}–{nextLabel} · {groupLabel(channel.group)}
                </Text>
              </View>
              <Pressable
                onPress={() => setDrawer("tools")}
                style={styles.iconButton}
                hitSlop={8}
              >
                <Ionicons name="options-outline" size={18} color={C.white} />
              </Pressable>
              <Pressable onPress={toggleTouchLock} style={styles.iconButton} hitSlop={8}>
                <Ionicons
                  name={playerSettings.touchLocked ? "lock-closed-outline" : "lock-open-outline"}
                  size={17}
                  color={C.white}
                />
              </Pressable>
            </BlurView>
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
          <View style={[styles.chipRow, { top: insets.top + 112 }]}>
            <Pressable onPress={cycleQuality} style={styles.chip}>
              <Ionicons name="resize-outline" size={11} color={C.textSoft} />
              <Text style={styles.chipText}>{qualityLabel}</Text>
            </Pressable>
            <Pressable onPress={cycleSpeed} style={styles.chip}>
              <Ionicons name="speedometer-outline" size={11} color={C.textSoft} />
              <Text style={styles.chipText}>{SPEED_OPTIONS[speedIndex]}×</Text>
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
          <View
            pointerEvents="box-none"
            style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}
          >
            <BlurView
              blurTarget={blurTargetRef}
              blurMethod="dimezisBlurViewSdk31Plus"
              intensity={84}
              tint="dark"
              style={styles.glassPanel}
            >
              <View style={styles.dvrHeader}>
                <Text style={styles.dvrLabel}>DVR TIMELINE</Text>
                <Text style={styles.dvrTimes}>
                  {nowLabel} · {nextLabel}
                </Text>
                <Pressable onPress={handleJumpToLive} style={styles.jumpLiveButton}>
                  <View style={styles.liveDot} />
                  <Text style={styles.jumpLiveText}>JUMP TO LIVE</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={handleScrub}
                onLayout={(event) => setScrubWidth(event.nativeEvent.layout.width)}
                style={styles.scrubTrack}
                accessibilityRole="adjustable"
                accessibilityLabel="DVR scrubber"
              >
                <View style={styles.scrubTrackBase} />
                <View
                  style={[
                    styles.scrubFill,
                    { width: `${Math.round(liveProgress * 100)}%` },
                  ]}
                />
                <View
                  style={[
                    styles.scrubThumb,
                    { left: `${Math.round(liveProgress * 100)}%` },
                  ]}
                />
              </Pressable>

              <View style={styles.transportRow}>
                <Pressable onPress={togglePlayback} style={styles.playButton}>
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={18}
                    color={C.bg}
                  />
                </Pressable>
                <Pressable
                  onPress={() => handleSeek(-10)}
                  style={styles.secondaryIconButton}
                >
                  <Ionicons name="play-back" size={17} color={C.white} />
                </Pressable>
                <Pressable
                  onPress={() => handleSeek(10)}
                  style={styles.secondaryIconButton}
                >
                  <Ionicons name="play-forward" size={17} color={C.white} />
                </Pressable>
                <Pressable
                  onPress={() => setDrawer("channels")}
                  style={styles.secondaryIconButton}
                >
                  <Ionicons name="tv-outline" size={17} color={C.white} />
                </Pressable>
                <Pressable
                  onPress={() => void toggleFavorite()}
                  style={styles.secondaryIconButton}
                >
                  <Ionicons
                    name={isFavorite ? "star" : "star-outline"}
                    size={17}
                    color={isFavorite ? C.accent : C.white}
                  />
                </Pressable>
                <Pressable
                  onPress={() => void videoRef.current?.enterFullscreen().catch(() => {})}
                  style={styles.secondaryIconButton}
                >
                  <Ionicons name="expand-outline" size={17} color={C.white} />
                </Pressable>
                <Pressable
                  onPress={() => applyNextAttempt()}
                  style={styles.secondaryIconButton}
                >
                  <Ionicons name="refresh-outline" size={17} color={C.white} />
                </Pressable>
              </View>

              <View style={styles.quickRow}>
                <Pressable onPress={cycleQuality} style={styles.quickButton}>
                  <Text style={styles.quickButtonText}>{qualityLabel}</Text>
                </Pressable>
                <Pressable onPress={toggleAudioOnly} style={styles.quickButton}>
                  <Ionicons name="musical-notes" size={12} color={playerSettings.audioOnly ? C.accent : C.textSoft} />
                  <Text style={styles.quickButtonText}>
                    {playerSettings.audioOnly ? "AUDIO" : "VIDEO"}
                  </Text>
                </Pressable>
                <Pressable onPress={cycleAspectRatio} style={styles.quickButton}>
                  <Text style={styles.quickButtonText}>
                    {ASPECT_RATIO_LABELS[playerSettings.aspectRatio].toUpperCase()}
                  </Text>
                </Pressable>
                <Pressable onPress={toggleZapping} style={styles.quickButton}>
                  <Text style={styles.quickButtonText}>
                    ZAP {playerSettings.zappingEnabled ? "ON" : "OFF"}
                  </Text>
                </Pressable>
              </View>

              <Pressable onPress={shareToCommunity} style={styles.shareButton}>
                <Ionicons name="radio-outline" size={16} color={C.bg} />
                <Text style={styles.shareButtonText}>REC 9s clip · share to community</Text>
                <Ionicons name="share-social-outline" size={14} color={C.bg} />
              </Pressable>

              {(pipActive || fullscreen) && (
                <Text style={styles.modeText}>
                  {fullscreen ? "Full-screen playback" : "Picture in picture"}
                </Text>
              )}
            </BlurView>
          </View>
        )}

        {notice && (
          <View pointerEvents="none" style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}
      </PlayerGestures>

      {playerSettings.touchLocked && !fullscreen && (
        <Pressable onPress={toggleTouchLock} style={[styles.unlockButton, { top: insets.top + 14 }]}>
          <Ionicons name="lock-closed-outline" size={17} color={C.bg} />
          <Text style={styles.unlockButtonText}>Unlock</Text>
        </Pressable>
      )}

      <PlayerChannelDrawer
        visible={drawer === "channels"}
        onClose={() => setDrawer(null)}
        channels={channels}
        activeId={channelId}
        favorites={favorites}
        onSelect={(next) => {
          setChannel(next);
          setNotice(`Tuned to ${next.name}`);
        }}
      />

      <PlayerToolsDrawer
        visible={drawer === "tools"}
        onClose={() => setDrawer(null)}
        stats={playerStats}
        sources={sourceVariants}
        activeSourceIndex={activeSourceIndex}
        onSelectSource={handleSelectSource}
        onSuggestBackup={handleSuggestBackup}
        zappingEnabled={playerSettings.zappingEnabled}
        onToggleZapping={toggleZapping}
        touchLocked={playerSettings.touchLocked}
        onToggleTouchLock={toggleTouchLock}
        audioOnly={playerSettings.audioOnly}
        onToggleAudioOnly={toggleAudioOnly}
        nightMode={playerSettings.nightMode}
        onToggleNightMode={toggleNightMode}
        backgroundAudio={settings.backgroundAudio}
        onToggleBackgroundAudio={toggleBackgroundAudio}
        pipSupported={pipSupported}
        onStartPip={() =>
          void videoRef.current?.startPictureInPicture().catch(() => {})
        }
        subtitleLabel={subtitleLabel}
        onCycleSubtitles={cycleSubtitles}
        aspectRatio={playerSettings.aspectRatio}
        onAspectRatioChange={(aspectRatio) => updatePlayerSetting({ aspectRatio })}
        qualityLabel={qualityLabel}
        onCycleQuality={cycleQuality}
        sleepMinutes={sleepMinutes}
        sleepRemainingSec={sleepRemainingSec}
        onSetSleepTimer={handleSetSleepTimer}
        onCaptureClip={() => {
          setDrawer(null);
          shareToCommunity();
        }}
      />

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
  hiddenVideo: { opacity: 0 },
  audioOnlyOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: C.black,
  },
  audioOnlyTitle: { color: C.white, fontSize: 17, fontWeight: "900", marginTop: 4 },
  audioOnlyDetail: { color: C.muted, fontSize: 11 },
  nightOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  glassPanel: {
    borderRadius: R.xl,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  hudChannelBlock: { flex: 1, minWidth: 0, marginHorizontal: 4 },
  hudBadgeRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  hudMeta: { color: C.accentBright, fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  behindPill: { backgroundColor: C.errorDim },
  dvrHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 9 },
  dvrLabel: { color: C.accent, fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  dvrTimes: { color: C.muted, fontSize: 9.5, flex: 1 },
  jumpLiveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  jumpLiveText: { color: C.white, fontSize: 8.5, fontWeight: "900", letterSpacing: 0.6 },
  scrubTrack: {
    height: 18,
    justifyContent: "center",
    marginBottom: 9,
  },
  scrubTrackBase: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  scrubFill: {
    position: "absolute",
    left: 0,
    top: 7,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.accent,
  },
  scrubThumb: {
    position: "absolute",
    top: 3,
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    backgroundColor: C.white,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  quickRow: { flexDirection: "row", gap: 6, marginTop: 11 },
  quickButton: {
    flex: 1,
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: R.md,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  quickButtonText: { color: C.textSoft, fontSize: 9, fontWeight: "900" },
  notice: {
    position: "absolute",
    alignSelf: "center",
    top: "22%",
    maxWidth: "84%",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: R.pill,
    backgroundColor: "rgba(0,0,0,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    zIndex: 20,
  },
  noticeText: { color: C.accentBright, fontSize: 10.5, fontWeight: "800", textAlign: "center" },
  unlockButton: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: R.pill,
    backgroundColor: C.accent,
    zIndex: 30,
  },
  unlockButtonText: { color: C.bg, fontSize: 10, fontWeight: "900" },
});
