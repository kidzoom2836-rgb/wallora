import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { EmptyState } from "../../components/ui/States";
import { SmartSearchBar } from "../../components/media/SmartSearchBar";
import { ChannelDetailModal } from "../../components/media/ChannelDetailModal";
import { ProgramReminderModal } from "../../components/media/ProgramReminderModal";
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
import {
  getCommunityLikes,
  getMostWatched,
  getTrending,
  rankChannels,
  setFavoriteBoost,
} from "../../lib/channelAnalytics";
import { findChannelMatches } from "../../lib/tvSearch";
import {
  channelCountry,
  channelGenre,
  COLLECTION_META,
  dedupeChannels,
  sortChannels,
  type CollectionType,
} from "../../lib/tvBrowse";
import { getTvSettings } from "../../lib/tvSettings";

const TYPE_KEYS = new Set<string>(Object.keys(COLLECTION_META));

function normalizeType(value?: string): CollectionType {
  return value && TYPE_KEYS.has(value) ? (value as CollectionType) : "all";
}

function initials(name: string) {
  return (
    name
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "TV"
  );
}

function RowLogo({ channel, index }: { channel: IptvChannel; index: number }) {
  const colors = ["#2E5A88", "#7A3F6B", "#3F6E5A", "#7A5A2E"];
  if (channel.logo) {
    return (
      <Image
        source={{ uri: channel.logo }}
        style={styles.logo}
        resizeMode="contain"
      />
    );
  }
  return (
    <View
      style={[styles.logo, { backgroundColor: colors[index % colors.length] }]}
    >
      <Text style={styles.logoText}>{initials(channel.name)}</Text>
    </View>
  );
}

/** Full-screen collection page for every WALLORA TV rail and browse page. */
export default function LiveTvCollectionScreen() {
  const params = useLocalSearchParams<{
    type?: string;
    value?: string;
    query?: string;
    sort?: string;
  }>();
  const type = normalizeType(params.type);
  const value = typeof params.value === "string" ? params.value : "";

  const [query, setQuery] = useState(typeof params.query === "string" ? params.query : "");
  const [sortMode, setSortMode] = useState<"recommended" | "az">(
    params.sort === "az" ? "az" : "recommended",
  );
  const [playlist, setPlaylist] = useState<{ channels: IptvChannel[] } | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ranked, setRanked] = useState<IptvChannel[]>([]);
  const [watched, setWatched] = useState<IptvChannel[]>([]);
  const [trending, setTrending] = useState<IptvChannel[]>([]);
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<IptvChannel | null>(null);
  const [programChannel, setProgramChannel] = useState<IptvChannel | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

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

  useEffect(() => {
    if (typeof params.query === "string") setQuery(params.query);
    if (params.sort === "az" || params.sort === "recommended") {
      setSortMode(params.sort);
    }
  }, [params.query, params.sort, type, value]);

  const load = useCallback(async () => {
    const [result, storedSettings, favs] = await Promise.all([
      loadPlaylist(),
      getTvSettings(),
      getFavoriteChannelIds(),
    ]);
    const channels = result.channels.filter((channel) => {
      if (storedSettings.hideGeoBlocked && channel.geoBlocked) return false;
      if (storedSettings.hideNot24x7 && channel.not24x7) return false;
      if (storedSettings.httpsOnly && channel.insecure) return false;
      return true;
    });
    setPlaylist({ channels });
    setFavorites(favs);

    const [rankedResult, watchedResult, trendingResult, likeResult] =
      await Promise.all([
        rankChannels(channels),
        getMostWatched(channels, 24),
        getTrending(channels, 24),
        getCommunityLikes(),
      ]);
    setRanked(dedupeChannels(rankedResult));
    setWatched(dedupeChannels(watchedResult));
    setTrending(dedupeChannels(trendingResult));
    setLikes(likeResult);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const allChannels = useMemo(() => playlist?.channels ?? [], [playlist]);

  const collection = useMemo(() => {
    const favIds = new Set(favorites);
    switch (type) {
      case "recommended":
        return ranked;
      case "featured":
        return dedupeChannels([
          ...allChannels.filter((channel) => channel.isFeatured),
          ...ranked.slice(0, 12),
        ]);
      case "watched":
        return watched;
      case "trending":
        return trending;
      case "favorites":
        return allChannels.filter((channel) => favIds.has(uniqueChannelId(channel)));
      case "group":
        return allChannels.filter((channel) => channelGenre(channel) === value);
      case "country":
        return allChannels.filter((channel) => channelCountry(channel) === value);
      case "genre":
        return allChannels.filter((channel) => channelGenre(channel) === value);
      case "search":
        return findChannelMatches(allChannels, query || value, allChannels.length).map(
          (match) => match.channel,
        );
      case "all":
      default:
        return allChannels;
    }
  }, [allChannels, favorites, query, ranked, trending, type, value, watched]);

  const matchedIds = useMemo(() => {
    const clean = query.trim();
    if (!clean) return null;
    return new Set(
      findChannelMatches(allChannels, clean, allChannels.length).map((match) =>
        uniqueChannelId(match.channel),
      ),
    );
  }, [allChannels, query]);

  const visible = useMemo(() => {
    const filtered = matchedIds
      ? collection.filter((channel) => matchedIds.has(uniqueChannelId(channel)))
      : collection;
    return sortChannels(filtered, sortMode);
  }, [collection, matchedIds, sortMode]);

  const meta = COLLECTION_META[type];
  const rankedById = useMemo(
    () => new Map(ranked.map((channel, index) => [uniqueChannelId(channel), index])),
    [ranked],
  );
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const openPlayer = useCallback(
    (channel?: IptvChannel) => {
      if (!channel) return;
      if (!termsAccepted) {
        setShowWelcome(true);
        return;
      }
      setSelected(null);
      router.push({
        pathname: "/live-tv/player",
        params: { channel: uniqueChannelId(channel) },
      });
    },
    [termsAccepted],
  );

  const watchSelected = useCallback(
    () => openPlayer(selected ?? undefined),
    [openPlayer, selected],
  );

  const toggleFavorite = useCallback(async (channel: IptvChannel) => {
    const id = uniqueChannelId(channel);
    const next = await toggleFavoriteChannel(id);
    setFavorites(next);
    await setFavoriteBoost(id, next.includes(id));
  }, []);

  const recommend = useCallback((channel: IptvChannel) => {
    setSelected(null);
    router.push({ pathname: "/community", params: { recommend: uniqueChannelId(channel) } });
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderRow = ({ item, index }: { item: IptvChannel; index: number }) => {
    const id = uniqueChannelId(item);
    return (
      <Pressable
        onPress={() => setSelected(item)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <RowLogo channel={item} index={index} />
        <View style={{ flex: 1, marginLeft: 11 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {groupLabel(item.group)}
          </Text>
        </View>
        {rankedById.has(id) && (
          <Text style={styles.rank}>#{rankedById.get(id)! + 1}</Text>
        )}
        <Pressable
          onPress={() => void toggleFavorite(item)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={favoriteSet.has(id) ? "Remove favorite" : "Add favorite"}
        >
          <Ionicons
            name={favoriteSet.has(id) ? "heart" : "heart-outline"}
            size={17}
            color={favoriteSet.has(id) ? C.accent : C.muted}
          />
        </Pressable>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={value || meta.title}
        subtitle={`${visible.length.toLocaleString()} channels · ${meta.subtitle || "WALLORA Live TV"}`}
      />

      <FlatList
        data={refreshing ? [] : visible}
        renderItem={renderRow}
        keyExtractor={uniqueChannelId}
        initialNumToRender={24}
        windowSize={12}
        removeClippedSubviews
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            {notice && <Text style={styles.notice}>{notice}</Text>}
            <SmartSearchBar
              value={query}
              onChangeText={setQuery}
              channels={allChannels}
              onSelectChannel={(channel) => setSelected(channel)}
            />
            <View style={styles.sortRow}>
              <Text style={styles.resultLabel}>
                {visible.length.toLocaleString()} channel
                {visible.length === 1 ? "" : "s"}
              </Text>
              <Pressable
                onPress={() =>
                  setSortMode((current) => (current === "az" ? "recommended" : "az"))
                }
                style={[styles.sortChip, sortMode === "az" && styles.sortChipActive]}
              >
                <Ionicons
                  name={sortMode === "az" ? "checkmark" : "swap-vertical-outline"}
                  size={13}
                  color={sortMode === "az" ? C.bg : C.accent}
                />
                <Text style={[styles.sortText, sortMode === "az" && styles.sortTextActive]}>
                  A–Z
                </Text>
              </Pressable>
            </View>
            {refreshing && (
              <View style={styles.loading}>
                <ActivityIndicator color={C.accent} />
              </View>
            )}
            {!refreshing && visible.length === 0 && (
              <EmptyState
                icon="tv-outline"
                title="No channels here yet"
                message="Try another search, category or playlist source."
              />
            )}
          </View>
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
        channel={selected}
        visible={!!selected}
        isFavorite={!!selected && favoriteSet.has(uniqueChannelId(selected))}
        likes={selected ? likes[uniqueChannelId(selected)] : undefined}
        rank={selected ? rankedById.get(uniqueChannelId(selected)) : undefined}
        onClose={() => setSelected(null)}
        onWatch={watchSelected}
        onToggleFavorite={() => {
          if (selected) void toggleFavorite(selected);
        }}
        onRecommend={() => {
          if (selected) recommend(selected);
        }}
        onMarkProgram={() => {
          setProgramChannel(selected);
          setSelected(null);
        }}
      />

      <ProgramReminderModal
        channel={programChannel}
        visible={!!programChannel}
        onClose={() => setProgramChannel(null)}
        onSaved={setNotice}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 40 },
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
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 16,
  },
  resultLabel: { color: C.muted, fontSize: 11, fontWeight: "800" },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  sortChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  sortText: { color: C.textSoft, fontSize: 10.5, fontWeight: "900" },
  sortTextActive: { color: C.bg },
  loading: { paddingVertical: 28, alignItems: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginHorizontal: 16,
    marginTop: 9,
    padding: 11,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderSoft,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  logo: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.raised },
  logoText: { color: C.white, fontSize: 14, fontWeight: "900", textAlign: "center", lineHeight: 44 },
  rowTitle: { color: C.text, fontSize: 12.5, fontWeight: "800" },
  rowMeta: { color: C.muted, fontSize: 10.5, marginTop: 3 },
  rank: { color: C.accent, fontSize: 10, fontWeight: "900", marginRight: 8 },
});
