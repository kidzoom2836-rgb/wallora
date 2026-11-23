import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEvent } from "expo";
import {
  useVideoPlayer,
  VideoView,
  isPictureInPictureSupported,
} from "expo-video";
import { ScreenHeader } from "../components/ui/ScreenHeader";
import { EmptyState } from "../components/ui/States";
import { C, R, SHADOW } from "../lib/theme";
import {
  DEFAULT_PLAYLIST_URL,
  getCustomPlaylistUrl,
  getFavoriteChannelIds,
  groupLabel,
  loadPlaylist,
  setCustomPlaylistUrl,
  toggleFavoriteChannel,
  uniqueChannelId,
  type IptvChannel,
  type PlaylistResult,
} from "../lib/iptv";

const CHANNEL_COLORS = [
  "#2E5A88",
  "#7A3F6B",
  "#3F6E5A",
  "#7A5A2E",
  "#4A3F7A",
  "#7A3F3F",
];
const FILL = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

function colorFor(index: number) {
  return CHANNEL_COLORS[index % CHANNEL_COLORS.length];
}

function initials(name: string) {
  return (
    name
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "TV"
  );
}

function ChannelLogo({
  channel,
  index,
  size = 34,
}: {
  channel: IptvChannel;
  index: number;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (channel.logo && !failed) {
    return (
      <Image
        source={{ uri: channel.logo }}
        style={{
          width: size,
          height: size,
          borderRadius: 9,
          backgroundColor: C.raised,
        }}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 9,
        backgroundColor: colorFor(index),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: C.white, fontSize: size * 0.3, fontWeight: "900" }}>
        {initials(channel.name)}
      </Text>
    </View>
  );
}

export default function LiveTvScreen() {
  const params = useLocalSearchParams<{ channel?: string }>();
  const [playlist, setPlaylist] = useState<PlaylistResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selected, setSelected] = useState<IptvChannel | null>(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [pipSupported] = useState(() => isPictureInPictureSupported());
  const videoRef = useRef<VideoView>(null);

  const load = useCallback(
    async (force = false) => {
      const [result, favs, customUrl] = await Promise.all([
        loadPlaylist({ force }),
        getFavoriteChannelIds(),
        getCustomPlaylistUrl(),
      ]);
      setPlaylist(result);
      setFavorites(favs);
      setCustomUrlInput(customUrl ?? "");
      setSelected((current) => {
        if (current) {
          const stillThere = result.channels.find(
            (c) => uniqueChannelId(c) === uniqueChannelId(current),
          );
          if (stillThere) return stillThere;
        }
        const requested = force ? undefined : params.channel;
        return (
          result.channels.find((c) => uniqueChannelId(c) === requested) ??
          result.channels.find((c) => favs.includes(uniqueChannelId(c))) ??
          result.channels[0] ??
          null
        );
      });
    },
    [params.channel],
  );

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const source = useMemo(
    () =>
      selected
        ? {
            uri: selected.url,
            metadata: {
              title: selected.name,
              artist: "WALLORA Live TV" as const,
            },
          }
        : null,
    [selected],
  );

  const player = useVideoPlayer(source, (instance) => {
    instance.staysActiveInBackground = true;
    instance.showNowPlayingNotification = false;
    instance.loop = false;
  });
  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });
  const { status } = useEvent(player, "statusChange", {
    status: player.status,
  });

  useEffect(() => {
    if (selected) player.play();
  }, [selected, player]);

  const channels = useMemo(() => playlist?.channels ?? [], [playlist]);
  const groups = useMemo(
    () => [
      "All",
      "Favorites",
      ...Array.from(new Set(channels.map((c) => groupLabel(c.group)))).sort(),
    ],
    [channels],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return channels.filter((channel) => {
      if (
        group === "Favorites" &&
        !favorites.includes(uniqueChannelId(channel))
      )
        return false;
      if (
        group !== "All" &&
        group !== "Favorites" &&
        groupLabel(channel.group) !== group
      )
        return false;
      if (
        q &&
        !`${channel.name} ${groupLabel(channel.group)}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [channels, favorites, group, query]);

  const favoriteIds = useMemo(() => new Set(favorites), [favorites]);
  const selectedId = selected ? uniqueChannelId(selected) : "";
  const isFavorite = !!selected && favoriteIds.has(selectedId);

  const onToggleFavorite = async () => {
    if (!selected) return;
    setFavorites(await toggleFavoriteChannel(uniqueChannelId(selected)));
  };

  const savePlaylist = async (reset = false) => {
    await setCustomPlaylistUrl(reset ? null : customUrlInput);
    setShowPlaylistModal(false);
    setLoading(true);
    await load(true);
    setLoading(false);
  };

  const renderChannel = ({
    item,
    index,
  }: {
    item: IptvChannel;
    index: number;
  }) => {
    const id = uniqueChannelId(item);
    const active = id === selectedId;
    return (
      <Pressable
        onPress={() => setSelected(item)}
        style={({ pressed }) => [
          styles.channelRow,
          active && styles.channelRowActive,
          pressed && styles.pressed,
        ]}
      >
        <ChannelLogo channel={item} index={index} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text
            style={[styles.channelName, active && styles.channelNameActive]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text style={styles.channelMeta} numberOfLines={1}>
            {groupLabel(item.group)}
          </Text>
        </View>
        <View style={styles.liveMini}>
          <View style={styles.liveDotMini} />
          <Text style={styles.liveMiniText}>LIVE</Text>
        </View>
        <Pressable
          onPress={() => toggleFavoriteChannel(id).then(setFavorites)}
          hitSlop={8}
          style={styles.starButton}
        >
          <Ionicons
            name={favoriteIds.has(id) ? "star" : "star-outline"}
            size={16}
            color={favoriteIds.has(id) ? C.accent : C.muted}
          />
        </Pressable>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="WALLORA Live TV"
        subtitle={`${channels.length.toLocaleString()} channels · real-time streams`}
        right={
          <Pressable
            onPress={() => setShowPlaylistModal(true)}
            hitSlop={10}
            style={styles.headerButton}
          >
            <Ionicons name="options-outline" size={19} color={C.text} />
          </Pressable>
        }
      />

      <FlatList
        data={loading ? [] : filtered}
        renderItem={renderChannel}
        keyExtractor={uniqueChannelId}
        initialNumToRender={20}
        windowSize={12}
        removeClippedSubviews
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.accent}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.playerCard}>
              <View style={styles.playerBox}>
                {selected ? (
                  <VideoView
                    ref={videoRef}
                    player={player}
                    style={StyleSheet.absoluteFill}
                    contentFit="contain"
                    nativeControls={false}
                    allowsPictureInPicture={pipSupported}
                    fullscreenOptions={{
                      enable: true,
                      orientation: "landscape",
                    }}
                  />
                ) : (
                  <View style={styles.playerPlaceholder}>
                    <Ionicons name="tv-outline" size={34} color={C.muted} />
                    <Text style={styles.playerPlaceholderText}>
                      No channels available
                    </Text>
                  </View>
                )}

                {status === "loading" && (
                  <View style={styles.playerOverlay}>
                    <ActivityIndicator color={C.accent} size="large" />
                    <Text style={styles.overlayText}>
                      Connecting to stream…
                    </Text>
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
                      This stream is offline. Try another channel.
                    </Text>
                  </View>
                )}

                <View style={styles.playerTop}>
                  <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.livePillText}>LIVE TV</Text>
                  </View>
                  <View style={styles.playerTopActions}>
                    <Pressable
                      onPress={onToggleFavorite}
                      hitSlop={8}
                      style={styles.playerIconButton}
                    >
                      <Ionicons
                        name={isFavorite ? "star" : "star-outline"}
                        size={18}
                        color={isFavorite ? C.accent : C.white}
                      />
                    </Pressable>
                    {pipSupported && (
                      <Pressable
                        onPress={() =>
                          videoRef.current
                            ?.startPictureInPicture()
                            .catch(() => {})
                        }
                        hitSlop={8}
                        style={styles.playerIconButton}
                      >
                        <Ionicons
                          name="copy-outline"
                          size={18}
                          color={C.white}
                        />
                      </Pressable>
                    )}
                  </View>
                </View>

                <View style={styles.playerBottom}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nowPlayingLabel}>NOW WATCHING</Text>
                    <Text style={styles.nowPlayingTitle} numberOfLines={1}>
                      {selected?.name ?? "Pick a channel"}
                    </Text>
                    <Text style={styles.nowPlayingGroup} numberOfLines={1}>
                      {selected
                        ? groupLabel(selected.group)
                        : "WALLORA Live TV"}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      videoRef.current?.enterFullscreen().catch(() => {})
                    }
                    style={styles.fullscreenButton}
                  >
                    <Ionicons name="expand-outline" size={19} color={C.bg} />
                  </Pressable>
                </View>
              </View>

              <Pressable
                onPress={() => (isPlaying ? player.pause() : player.play())}
                style={styles.playToggle}
              >
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={16}
                  color={C.bg}
                />
                <Text style={styles.playToggleText}>
                  {isPlaying ? "Pause stream" : "Play stream"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.infoRow}>
              <Ionicons
                name="information-circle-outline"
                size={15}
                color={playlist?.offline ? C.accent : C.success}
              />
              <Text style={styles.infoText} numberOfLines={2}>
                {playlist?.offline
                  ? "Showing cached or demo channels — the playlist could not be reached right now."
                  : `${playlist?.sourceLabel ?? "Playlist"} · ${playlist?.fetchedAt ? new Date(playlist.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "just now"}`}
              </Text>
            </View>

            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={17} color={C.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search channels"
                placeholderTextColor={C.mutedDark}
                style={styles.searchInput}
                autoCorrect={false}
              />
              {!!query && (
                <Pressable onPress={() => setQuery("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color={C.muted} />
                </Pressable>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.groups}
            >
              {groups.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setGroup(item)}
                  style={[
                    styles.groupChip,
                    group === item && styles.groupChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.groupChipText,
                      group === item && styles.groupChipTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.resultsLabel}>
              {filtered.length.toLocaleString()} channel
              {filtered.length === 1 ? "" : "s"}
            </Text>

            {loading && (
              <View style={styles.loading}>
                <ActivityIndicator color={C.accent} size="large" />
                <Text style={styles.loadingText}>Loading channel guide…</Text>
              </View>
            )}
            {!loading && filtered.length === 0 && (
              <EmptyState
                icon="tv-outline"
                title="No channels found"
                message="Try a different search or add your own M3U playlist from the menu."
                actionLabel="Change playlist"
                onAction={() => setShowPlaylistModal(true)}
              />
            )}
          </View>
        }
        ListFooterComponent={
          <Text style={styles.disclaimer}>
            Streams are provided by the selected playlist. WALLORA does not host
            or control third-party channels.
          </Text>
        }
      />

      {showPlaylistModal && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setShowPlaylistModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalEyebrow}>PLAYLIST SOURCE</Text>
              <Text style={styles.modalTitle}>Add an M3U playlist</Text>
              <Text style={styles.modalBody}>
                Paste a .m3u or .m3u8 URL to load your own channels. Leave it
                empty to use the WALLORA community playlist.
              </Text>
              <TextInput
                value={customUrlInput}
                onChangeText={setCustomUrlInput}
                placeholder={DEFAULT_PLAYLIST_URL}
                placeholderTextColor={C.mutedDark}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.modalInput}
              />
              <Pressable
                onPress={() => savePlaylist(false)}
                style={styles.modalPrimary}
              >
                <Ionicons name="checkmark" size={17} color={C.bg} />
                <Text style={styles.modalPrimaryText}>Save playlist</Text>
              </Pressable>
              <Pressable
                onPress={() => savePlaylist(true)}
                style={styles.modalSecondary}
              >
                <Text style={styles.modalSecondaryText}>
                  Reset to community playlist
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowPlaylistModal(false)}
                style={styles.modalCancel}
              >
                <Text style={styles.modalCancelText}>Close</Text>
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
  playerBox: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: C.bgDeep,
    overflow: "hidden",
  },
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
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FF4D4D" },
  livePillText: {
    color: C.white,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  playerTopActions: { flexDirection: "row", gap: 6 },
  playerIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  playerBottom: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  nowPlayingLabel: {
    color: C.accent,
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 1,
  },
  nowPlayingTitle: {
    color: C.white,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
    textShadowColor: "#000",
    textShadowRadius: 4,
  },
  nowPlayingGroup: { color: C.textSoft, fontSize: 10.5, marginTop: 2 },
  fullscreenButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  playToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.borderSoft,
  },
  playToggleText: { color: C.accent, fontSize: 12, fontWeight: "800" },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginHorizontal: 18,
    marginTop: 10,
  },
  infoText: { flex: 1, color: C.muted, fontSize: 10.5, lineHeight: 15 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginHorizontal: 16,
    marginTop: 18,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 13 },
  groups: { gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  groupChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: R.pill,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  groupChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  groupChipText: { color: C.textSoft, fontSize: 11, fontWeight: "700" },
  groupChipTextActive: { color: C.bg },
  resultsLabel: {
    paddingHorizontal: 16,
    marginBottom: 8,
    color: C.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  loading: { paddingVertical: 50, alignItems: "center", gap: 10 },
  loadingText: { color: C.muted, fontSize: 12 },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSoft,
  },
  channelRowActive: { backgroundColor: C.accentDim },
  pressed: { opacity: 0.7 },
  channelName: { color: C.text, fontSize: 12.5, fontWeight: "700" },
  channelNameActive: { color: C.accentBright },
  channelMeta: { color: C.muted, fontSize: 10, marginTop: 2 },
  liveMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginRight: 8,
  },
  liveDotMini: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#FF4D4D",
  },
  liveMiniText: { color: "#FF6B6B", fontSize: 8.5, fontWeight: "900" },
  starButton: { padding: 5 },
  disclaimer: {
    color: C.mutedDark,
    fontSize: 10,
    lineHeight: 15,
    marginHorizontal: 16,
    marginTop: 24,
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  modalCard: {
    backgroundColor: C.bgElevated,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    padding: 22,
    paddingBottom: 32,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.raisedHover,
    alignSelf: "center",
    marginBottom: 16,
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
  modalSecondary: {
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 13,
    marginTop: 10,
    alignItems: "center",
  },
  modalSecondaryText: { color: C.textSoft, fontWeight: "700", fontSize: 12.5 },
  modalCancel: { alignItems: "center", paddingVertical: 12 },
  modalCancelText: { color: C.muted, fontSize: 12 },
});
