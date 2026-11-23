import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { EmptyState } from "../../components/ui/States";
import { MediaRail } from "../../components/ui/MediaRail";
import type { MediaItem } from "../../components/ui/MediaCard";
import { SmartSearchBar } from "../../components/media/SmartSearchBar";
import { ChannelDetailModal } from "../../components/media/ChannelDetailModal";
import { ProgramReminderModal } from "../../components/media/ProgramReminderModal";
import {
  hasAcceptedTvTerms,
  TvWelcomeModal,
} from "../../components/media/TvWelcomeModal";
import { C, R, SHADOW } from "../../lib/theme";
import { apiJson } from "../../lib/api";
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
} from "../../lib/iptv";
import {
  getCommunityLikes,
  getMostWatched,
  getTrending,
  rankChannels,
  setFavoriteBoost,
  type RankedChannel,
} from "../../lib/channelAnalytics";
import { findChannelMatches } from "../../lib/tvSearch";
import {
  DEFAULT_TV_SETTINGS,
  getTvSettings,
  type TvSettings,
} from "../../lib/tvSettings";

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
const SPECIAL_GROUPS = new Set(["All", "Favorites", "Most watched", "Trending"]);

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
  const [tvSettings, setTvSettings] = useState<TvSettings>(DEFAULT_TV_SETTINGS);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selected, setSelected] = useState<IptvChannel | null>(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState("");

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [ranked, setRanked] = useState<RankedChannel[]>([]);
  const [mostWatched, setMostWatched] = useState<RankedChannel[]>([]);
  const [trending, setTrending] = useState<RankedChannel[]>([]);
  const [communityLikes, setCommunityLikes] = useState<Record<string, number>>({});
  const [adminFeatured, setAdminFeatured] = useState<IptvChannel[]>([]);
  const [statsVersion, setStatsVersion] = useState(0);
  const [recommendChannel, setRecommendChannel] = useState<IptvChannel | null>(
    null,
  );
  const [detailChannel, setDetailChannel] = useState<IptvChannel | null>(null);
  const [programChannel, setProgramChannel] = useState<IptvChannel | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    hasAcceptedTvTerms()
      .then((accepted) => {
        if (!alive) return;
        setTermsAccepted(accepted);
        setShowWelcome(!accepted);
      })
      .catch(() => {
        if (alive) setShowWelcome(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Picking settings from this guide (or returning from TV settings) must
  // refresh the local filters immediately.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getTvSettings()
        .then((stored) => {
          if (alive) setTvSettings(stored);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

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

  useEffect(() => {
    let alive = true;
    void (async () => {
      const customUrl = await getCustomPlaylistUrl().catch(() => null);
      if (customUrl || !alive) return;
      try {
        const response = await apiJson<{ items?: IptvChannel[] }>(
          "/api/v1/channels?featured=1&limit=24",
        );
        if (!alive) return;
        setAdminFeatured(
          (response?.items ?? []).filter((channel) => channel?.isFeatured),
        );
      } catch {
        if (alive) setAdminFeatured([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const sourceChannels = useMemo(() => playlist?.channels ?? [], [playlist]);

  // Guide tools from TV settings: hide noisy public-stream categories and sort.
  const channels = useMemo(() => {
    const visible = sourceChannels.filter((channel) => {
      if (tvSettings.hideGeoBlocked && channel.geoBlocked) return false;
      if (tvSettings.hideNot24x7 && channel.not24x7) return false;
      if (tvSettings.httpsOnly && channel.insecure) return false;
      return true;
    });
    if (tvSettings.guideSort === "az") {
      return [...visible].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (tvSettings.guideSort === "group") {
      return [...visible].sort(
        (a, b) =>
          groupLabel(a.group).localeCompare(groupLabel(b.group)) ||
          a.name.localeCompare(b.name),
      );
    }
    return visible;
  }, [sourceChannels, tvSettings.guideSort, tvSettings.hideGeoBlocked, tvSettings.hideNot24x7, tvSettings.httpsOnly]);

  const selectedId = selected ? uniqueChannelId(selected) : "";

  useEffect(() => {
    if (!channels.length) {
      setRanked([]);
      setMostWatched([]);
      setTrending([]);
      return;
    }
    let alive = true;
    Promise.all([
      rankChannels(channels),
      getMostWatched(channels, 12),
      getTrending(channels, 12),
    ])
      .then(([rankedResult, watchedResult, trendingResult]) => {
        if (!alive) return;
        setRanked(rankedResult);
        setMostWatched(watchedResult);
        setTrending(trendingResult);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [channels, statsVersion]);

  useEffect(() => {
    let alive = true;
    getCommunityLikes()
      .then((likes) => {
        if (alive) setCommunityLikes(likes);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [statsVersion]);

  const groups = useMemo(
    () => [
      "All",
      "Most watched",
      "Trending",
      "Favorites",
      ...Array.from(new Set(channels.map((c) => groupLabel(c.group)))).sort(),
    ],
    [channels],
  );

  const favoriteIds = useMemo(() => new Set(favorites), [favorites]);
  const watchedIds = useMemo(
    () => new Set(mostWatched.map(uniqueChannelId)),
    [mostWatched],
  );
  const trendingIds = useMemo(
    () => new Set(trending.map(uniqueChannelId)),
    [trending],
  );

  const matchedIds = useMemo(() => {
    const clean = query.trim();
    if (!clean) return null;
    return new Set(
      findChannelMatches(channels, clean, channels.length).map((match) =>
        uniqueChannelId(match.channel),
      ),
    );
  }, [channels, query]);

  const filtered = useMemo(() => {
    return channels.filter((channel) => {
      const id = uniqueChannelId(channel);
      if (group === "Favorites" && !favoriteIds.has(id)) return false;
      if (group === "Most watched" && !watchedIds.has(id)) return false;
      if (group === "Trending" && !trendingIds.has(id)) return false;
      if (
        group !== "All" &&
        !SPECIAL_GROUPS.has(group) &&
        groupLabel(channel.group) !== group
      )
        return false;
      if (matchedIds && !matchedIds.has(id)) return false;
      return true;
    });
  }, [channels, favoriteIds, group, matchedIds, trendingIds, watchedIds]);

  const heroChannel = selected ?? ranked[0] ?? channels[0] ?? null;
  const heroRank = heroChannel
    ? ranked.findIndex(
        (channel) => uniqueChannelId(channel) === uniqueChannelId(heroChannel!),
      )
    : -1;
  const heroIndex = Math.max(0, heroRank);

  const toMediaItem = useCallback(
    (channel: IptvChannel, index: number, badge?: string): MediaItem => {
      const id = uniqueChannelId(channel);
      return {
        id,
        title: channel.name,
        imageUrl: channel.logo ?? "",
        subtitle: groupLabel(channel.group),
        badge,
        rank: index + 1,
        likes: communityLikes[id] || undefined,
        accentColor: colorFor(index),
        onPress: () => setDetailChannel(channel),
      };
    },
    [communityLikes],
  );

  const mostWatchedItems = useMemo(
    () => mostWatched.slice(0, 12).map((channel, i) => toMediaItem(channel, i)),
    [mostWatched, toMediaItem],
  );
  const trendingItems = useMemo(
    () => trending.slice(0, 12).map((channel, i) => toMediaItem(channel, i)),
    [trending, toMediaItem],
  );
  const favoritesItems = useMemo(
    () =>
      channels
        .filter((channel) => favoriteIds.has(uniqueChannelId(channel)))
        .slice(0, 12)
        .map((channel, i) => toMediaItem(channel, i)),
    [channels, favoriteIds, toMediaItem],
  );
  const recommendedItems = useMemo(
    () => ranked.slice(0, 12).map((channel, i) => toMediaItem(channel, i)),
    [ranked, toMediaItem],
  );
  const allItems = useMemo(
    () => channels.slice(0, 12).map((channel, i) => toMediaItem(channel, i)),
    [channels, toMediaItem],
  );
  const featuredItems = useMemo(() => {
    const seen = new Set<string>();
    const adminPicks = [...adminFeatured, ...channels.filter((channel) => channel.isFeatured)]
      .filter((channel) => {
        const id = uniqueChannelId(channel);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map((channel) => ({ ...channel, isFeatured: true }));
    const source = adminPicks.length ? adminPicks : ranked.slice(0, 8);
    return source.slice(0, 12).map((channel, i) =>
      toMediaItem(channel, i, channel.isFeatured ? "ADMIN PICK" : undefined),
    );
  }, [adminFeatured, channels, ranked, toMediaItem]);

  const handleToggleFavorite = async (channel?: IptvChannel) => {
    if (!channel) return;
    const id = uniqueChannelId(channel);
    const next = await toggleFavoriteChannel(id);
    setFavorites(next);
    await setFavoriteBoost(id, next.includes(id));
    setStatsVersion((value) => value + 1);
  };

  const openPlayer = useCallback(
    (channel?: IptvChannel) => {
      if (!channel) return;
      if (!termsAccepted) {
        setShowWelcome(true);
        return;
      }
      setSelected(channel);
      setDetailChannel(null);
      router.push({
        pathname: "/live-tv/player",
        params: { channel: uniqueChannelId(channel) },
      });
    },
    [termsAccepted],
  );

  const watchDetail = useCallback(
    () => openPlayer(detailChannel ?? undefined),
    [detailChannel, openPlayer],
  );


  const pushRecommendation = (channel: IptvChannel) => {
    const channelId = uniqueChannelId(channel);
    setRecommendChannel(null);
    try {
      router.push({ pathname: "/community", params: { recommend: channelId } });
    } catch {}
  };

  const shareRecommendation = async (channel: IptvChannel) => {
    try {
      await Share.share({
        title: "WALLORA TV recommendation",
        message: `Watch ${channel.name} on WALLORA TV`,
      });
    } catch {}
    pushRecommendation(channel);
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
        onPress={() => setDetailChannel(item)}
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
          onPress={() => handleToggleFavorite(item)}
          hitSlop={8}
          style={styles.starButton}
          accessibilityRole="button"
          accessibilityLabel={favoriteIds.has(id) ? "Remove favorite" : "Add favorite"}
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
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push("/live-tv/reminders")}
              hitSlop={10}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Channel reminders"
            >
              <Ionicons name="alarm-outline" size={19} color={C.text} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/live-tv/settings")}
              hitSlop={10}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Live TV settings"
            >
              <Ionicons name="settings-outline" size={19} color={C.text} />
            </Pressable>
          </View>
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
            {notice && <Text style={styles.notice}>{notice}</Text>}
            <SmartSearchBar
              value={query}
              onChangeText={setQuery}
              channels={channels}
              onSelectChannel={(channel) => setDetailChannel(channel)}
            />

            {heroChannel && (
              <View style={[styles.heroCard, { backgroundColor: colorFor(heroIndex) }]}>
                <LinearGradient
                  colors={["rgba(7,8,10,0.2)", "rgba(7,8,10,0.86)", C.bgDeep]}
                  locations={[0, 0.48, 1]}
                  style={FILL}
                />
                <View style={styles.heroTop}>
                  <View style={styles.heroLivePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.heroLiveText}>LIVE NOW</Text>
                  </View>
                  <View style={styles.heroGroupBadge}>
                    <Text style={styles.heroGroupText} numberOfLines={1}>
                      {groupLabel(heroChannel.group)}
                    </Text>
                  </View>
                </View>
                <View style={styles.heroBody}>
                  <ChannelLogo channel={heroChannel} index={heroIndex} size={54} />
                  <View style={styles.heroCopy}>
                    <Text style={styles.heroEyebrow}>
                      {selected ? "NOW WATCHING" : "FEATURED CHANNEL"}
                    </Text>
                    <Text style={styles.heroTitle} numberOfLines={2}>
                      {heroChannel.name}
                    </Text>
                    <Text style={styles.heroMeta} numberOfLines={1}>
                      {heroRank >= 0 ? `#${heroRank + 1} in WALLORA` : "WALLORA Live TV"}
                      {communityLikes[uniqueChannelId(heroChannel)]
                        ? ` · ${communityLikes[uniqueChannelId(heroChannel)]} likes`
                        : ""}
                    </Text>
                  </View>
                </View>
                <View style={styles.heroActions}>
                  <Pressable
                    onPress={() => openPlayer(heroChannel)}
                    style={({ pressed }) => [
                      styles.heroPrimary,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons name="play" size={15} color={C.bg} />
                    <Text style={styles.heroPrimaryText}>Watch now</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setRecommendChannel(heroChannel)}
                    style={({ pressed }) => [
                      styles.heroSecondary,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons name="heart-outline" size={15} color={C.text} />
                    <Text style={styles.heroSecondaryText}>Recommend</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <Pressable
              onPress={() => openPlayer(heroChannel ?? undefined)}
              style={({ pressed }) => [
                styles.playerCard,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Open full screen WALLORA TV player"
            >
              <LinearGradient
                colors={[C.raised, C.bgElevated, C.bgDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={FILL}
              />
              <View style={styles.playerCardHead}>
                <View style={styles.livePill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.livePillText}>LIVE TV</Text>
                </View>
                <View style={styles.fullScreenPill}>
                  <Ionicons name="expand-outline" size={12} color={C.accent} />
                  <Text style={styles.fullScreenPillText}>FULL SCREEN</Text>
                </View>
              </View>
              <View style={styles.playerCardBody}>
                {heroChannel ? (
                  <ChannelLogo channel={heroChannel} index={heroIndex} size={48} />
                ) : (
                  <View style={styles.playerPlaceholder}>
                    <Ionicons name="tv-outline" size={28} color={C.muted} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.nowPlayingLabel}>NOW PLAYING</Text>
                  <Text style={styles.nowPlayingTitle} numberOfLines={1}>
                    {heroChannel?.name ?? "Pick a channel"}
                  </Text>
                  <Text style={styles.nowPlayingGroup} numberOfLines={1}>
                    {heroChannel ? groupLabel(heroChannel.group) : "WALLORA Live TV"}
                  </Text>
                </View>
                <Ionicons name="play-circle" size={34} color={C.accent} />
              </View>
              <View style={styles.playerCardFooter}>
                <Ionicons
                  name="information-circle-outline"
                  size={13}
                  color={C.textSoft}
                />
                <Text style={styles.playerCardFooterText}>
                  Full-screen player · CC · quality · share to community
                </Text>
              </View>
            </Pressable>

            <View style={styles.quickActions}>
              <Pressable
                onPress={() => router.push("/live-tv/settings")}
                style={styles.quickAction}
              >
                <Ionicons name="settings-outline" size={16} color={C.accent} />
                <Text style={styles.quickActionText}>TV settings</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/live-tv/reminders")}
                style={styles.quickAction}
              >
                <Ionicons name="alarm-outline" size={16} color={C.accent} />
                <Text style={styles.quickActionText}>Reminders</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>EXPLORE WALLORA TV</Text>
            <View style={styles.exploreGrid}>
              {[
                { label: "Categories", icon: "pricetags-outline" as const },
                { label: "Countries", icon: "earth-outline" as const },
                { label: "Genres", icon: "film-outline" as const },
                { label: "A–Z guide", icon: "grid-outline" as const },
              ].map((tile) => (
                <Pressable
                  key={tile.label}
                  onPress={() => router.push("/live-tv/explore")}
                  style={({ pressed }) => [
                    styles.exploreTile,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name={tile.icon} size={18} color={C.accent} />
                  <Text style={styles.exploreTileText}>{tile.label}</Text>
                </Pressable>
              ))}
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

            <MediaRail
              title="Featured on WALLORA"
              subtitle="Admin-recommended channels"
              items={featuredItems}
              onSeeAll={() =>
                router.push({ pathname: "/live-tv/collection", params: { type: "featured" } })
              }
              autoScroll={false}
            />
            <MediaRail
              title="Most watched by you"
              subtitle="Your personal top channels"
              items={mostWatchedItems}
              onSeeAll={() =>
                router.push({ pathname: "/live-tv/collection", params: { type: "watched" } })
              }
              autoScroll={false}
            />
            <MediaRail
              title="Trending in WALLORA"
              subtitle="Popular with the community"
              items={trendingItems}
              onSeeAll={() =>
                router.push({ pathname: "/live-tv/collection", params: { type: "trending" } })
              }
              autoScroll={false}
            />
            <MediaRail
              title="Favorites"
              subtitle="Saved for quick access"
              items={favoritesItems}
              onSeeAll={() =>
                router.push({ pathname: "/live-tv/collection", params: { type: "favorites" } })
              }
              autoScroll={false}
            />
            <MediaRail
              title="Recommended for you"
              subtitle="Picked from your favorites, history and community likes"
              items={recommendedItems}
              onSeeAll={() =>
                router.push({ pathname: "/live-tv/collection", params: { type: "recommended" } })
              }
              autoScroll={false}
            />
            <MediaRail
              title="All channels"
              subtitle="Top channels from the current playlist"
              items={allItems}
              onSeeAll={() =>
                router.push({ pathname: "/live-tv/collection", params: { type: "all", sort: "az" } })
              }
              autoScroll={false}
            />

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

      <TvWelcomeModal
        visible={showWelcome}
        onAccept={() => {
          setTermsAccepted(true);
          setShowWelcome(false);
        }}
        onLater={() => setShowWelcome(false)}
      />

      <ChannelDetailModal
        channel={detailChannel}
        visible={!!detailChannel}
        isFavorite={
          !!detailChannel && favoriteIds.has(uniqueChannelId(detailChannel))
        }
        likes={detailChannel ? communityLikes[uniqueChannelId(detailChannel)] : undefined}
        rank={
          detailChannel
            ? (() => {
                const index = ranked.findIndex(
                  (channel) =>
                    uniqueChannelId(channel) === uniqueChannelId(detailChannel!),
                );
                return index >= 0 ? index : undefined;
              })()
            : undefined
        }
        onClose={() => setDetailChannel(null)}
        onWatch={watchDetail}
        onToggleFavorite={() => {
          if (detailChannel) void handleToggleFavorite(detailChannel);
        }}
        onRecommend={() => {
          if (detailChannel) {
            setRecommendChannel(detailChannel);
            setDetailChannel(null);
          }
        }}
        onMarkProgram={() => {
          setProgramChannel(detailChannel);
          setDetailChannel(null);
        }}
      />

      <ProgramReminderModal
        channel={programChannel}
        visible={!!programChannel}
        onClose={() => setProgramChannel(null)}
        onSaved={setNotice}
      />

      {recommendChannel && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setRecommendChannel(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalEyebrow}>COMMUNITY PICK</Text>
              <Text style={styles.modalTitle}>Recommend this channel</Text>

              <View style={styles.recommendPreview}>
                <LinearGradient
                  colors={[C.accentDim, C.card]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={FILL}
                />
                <ChannelLogo channel={recommendChannel} index={0} size={46} />
                <View style={{ flex: 1, marginLeft: 11 }}>
                  <Text style={styles.recommendName} numberOfLines={1}>
                    {recommendChannel.name}
                  </Text>
                  <Text style={styles.recommendMeta} numberOfLines={1}>
                    {groupLabel(recommendChannel.group)} · LIVE
                  </Text>
                </View>
              </View>

              <View style={styles.uploadNotice}>
                <Ionicons
                  name="information-circle-outline"
                  size={15}
                  color={C.accent}
                />
                <Text style={styles.uploadNoticeText}>
                  A 9-second preview is captured directly from this live
                  channel when you post — no upload needed.
                </Text>
              </View>

              <Pressable
                onPress={() => pushRecommendation(recommendChannel)}
                style={styles.modalPrimary}
              >
                <Ionicons name="people-outline" size={17} color={C.bg} />
                <Text style={styles.modalPrimaryText}>Post 9s live clip</Text>
              </Pressable>
              <Pressable
                onPress={() => shareRecommendation(recommendChannel)}
                style={styles.modalSecondary}
              >
                <Ionicons name="share-outline" size={15} color={C.textSoft} />
                <Text style={styles.modalSecondaryText}>Share link</Text>
              </Pressable>
              <Pressable
                onPress={() => setRecommendChannel(null)}
                style={styles.modalCancel}
              >
                <Text style={styles.modalCancelText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

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
  heroCard: {
    marginHorizontal: 16,
    marginTop: 14,
    minHeight: 224,
    borderRadius: R.xl,
    overflow: "hidden",
    padding: 16,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: C.border,
    ...SHADOW.hero,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroLivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  heroLiveText: {
    color: C.white,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  heroGroupBadge: {
    maxWidth: "55%",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: "rgba(215,184,121,0.35)",
  },
  heroGroupText: { color: C.accentBright, fontSize: 9.5, fontWeight: "800" },
  heroBody: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 26 },
  heroCopy: { flex: 1, minWidth: 0 },
  heroEyebrow: {
    color: C.accent,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  heroTitle: {
    color: C.white,
    fontSize: 21,
    fontWeight: "900",
    marginTop: 3,
    textShadowColor: "#000",
    textShadowRadius: 6,
  },
  heroMeta: { color: C.textSoft, fontSize: 10.5, marginTop: 4 },
  heroActions: { flexDirection: "row", gap: 9, marginTop: 18 },
  heroPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 11,
    borderRadius: R.md,
    backgroundColor: C.accent,
  },
  heroPrimaryText: { color: C.bg, fontSize: 12.5, fontWeight: "900" },
  heroSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 11,
    borderRadius: R.md,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  heroSecondaryText: { color: C.text, fontSize: 12.5, fontWeight: "800" },
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
  lockedOverlay: {
    ...FILL,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "rgba(0,0,0,0.78)",
    paddingHorizontal: 24,
  },
  lockedTitle: {
    color: C.text,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 4,
  },
  lockedSubtitle: { color: C.muted, fontSize: 10.5, textAlign: "center" },
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
  playerChips: {
    position: "absolute",
    top: 49,
    left: 10,
    flexDirection: "row",
    gap: 6,
  },
  controlChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  controlChipMuted: { opacity: 0.65 },
  controlChipText: {
    color: C.textSoft,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  fullScreenPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: C.accentDim,
  },
  fullScreenPillText: {
    color: C.accent,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  playerCard: {
    position: "relative",
    overflow: "hidden",
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.borderSoft,
    ...SHADOW.card,
  },
  playerCardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  playerCardBody: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },
  playerCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: C.borderSoft,
  },
  playerCardFooterText: {
    color: C.textSoft,
    fontSize: 11,
    fontWeight: "600",
  },
  quickActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  quickAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 11,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderSoft,
  },
  quickActionText: {
    color: C.text,
    fontSize: 12,
    fontWeight: "700",
  },
  notice: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 10,
    borderRadius: R.md,
    backgroundColor: C.accentDim,
    color: C.accentBright,
    fontSize: 11,
    fontWeight: "700",
  },
  sectionLabel: {
    color: C.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.3,
    marginHorizontal: 18,
    marginTop: 18,
  },
  exploreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  exploreTile: {
    width: "47%",
    minHeight: 66,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderSoft,
    padding: 12,
    gap: 7,
  },
  exploreTileText: {
    color: C.text,
    fontSize: 12,
    fontWeight: "800",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginHorizontal: 18,
    marginTop: 10,
  },
  infoText: { flex: 1, color: C.muted, fontSize: 10.5, lineHeight: 15 },
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
  recommendPreview: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 70,
    marginTop: 16,
    padding: 12,
    borderRadius: R.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
  },
  recommendName: { color: C.text, fontSize: 13, fontWeight: "800" },
  recommendMeta: { color: C.muted, fontSize: 10, marginTop: 3 },
  uploadNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 13,
    padding: 11,
    borderRadius: R.md,
    backgroundColor: C.accentDim,
  },
  uploadNoticeText: {
    flex: 1,
    color: C.textSoft,
    fontSize: 11,
    lineHeight: 16,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 13,
    marginTop: 10,
  },
  modalSecondaryText: { color: C.textSoft, fontWeight: "700", fontSize: 12.5 },
  modalCancel: { alignItems: "center", paddingVertical: 12 },
  modalCancelText: { color: C.muted, fontSize: 12 },
});
