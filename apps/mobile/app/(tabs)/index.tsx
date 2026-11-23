import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppState,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { apiJson } from "../../lib/api";
import { assetUrl } from "../../lib/config";
import { useAuth } from "../../lib/auth";
import { C, R, SHADOW, tierMeta } from "../../lib/theme";
import { MediaRail } from "../../components/ui/MediaRail";
import type { MediaItem } from "../../components/ui/MediaCard";
import { VerifiedBadge } from "../../components/ui/VerifiedBadge";
import { LiveNowModal } from "../../components/media/LiveNowModal";
import { UpcomingReminderRail } from "../../components/media/UpcomingReminderRail";
import { listTvReminders, type TvReminder } from "../../lib/tvReminders";
import {
  groupLabel,
  loadPlaylist,
  uniqueChannelId,
  type IptvChannel,
} from "../../lib/iptv";

type Creator = {
  username?: string;
  displayName?: string;
  verified?: boolean;
  tier?: string | null;
  avatarUrl?: string | null;
};

type Wallpaper = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  orientation?: string;
  dominantColor?: string | null;
  likeCount?: number;
  downloadCount?: number;
  viewCount?: number;
  category?: { slug: string; name: string } | null;
  creator?: Creator | null;
  asset?: { objectKey: string; width?: number; height?: number } | null;
};

type ShowroomItem = {
  id: string;
  title?: string;
  caption?: string;
  imageUrl?: string | null;
  wallpaperSlug?: string | null;
};

type Showroom = {
  username: string;
  headline?: string;
  description?: string | null;
  itemCount?: number;
  owner?: {
    displayName?: string;
    avatarUrl?: string | null;
    tier?: string | null;
  };
  items?: ShowroomItem[];
};

type CommunityPost = {
  id: string;
  body: string;
  kind?: string;
  imageUrl?: string | null;
  likeCount?: number;
  commentCount?: number;
  repostCount?: number;
  author?: Creator;
  createdAt?: string;
};

type PublicSite = {
  id: string;
  slug: string;
  title: string;
  prompt: string;
  forSale?: boolean;
  priceCents?: number;
  createdAt?: string;
};

type ShowcaseProject = {
  id: string;
  name?: string;
  description?: string | null;
  coverUrl?: string | null;
  owner?: Creator;
};

type Page<T> = { items: T[]; pagination?: { total?: number } };

const WELCOME_KEY = "wallora.home.welcome.v1";
const LIVE_POPUP_KEY = "wallora.home.livePopup.v1";
const LIVE_COLORS = ["#2E5A88", "#7A3F6B", "#3F6E5A", "#7A5A2E"];

function imageOf(ref?: string | null) {
  return assetUrl(ref) ?? "";
}

function count(n?: number) {
  if (!n) return "0";
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function wallpaperCard(w: Wallpaper, rank?: number): MediaItem {
  return {
    id: w.id,
    title: w.title,
    imageUrl: imageOf(w.asset?.objectKey),
    subtitle: w.category?.name,
    creator: w.creator?.displayName ?? w.creator?.username,
    creatorTier: w.creator?.tier,
    likes: w.likeCount ?? 0,
    downloads: w.downloadCount ?? 0,
    accentColor: w.dominantColor ?? undefined,
    rank,
    href: `/wallpaper/${w.slug}`,
    onPress: undefined,
  };
}

const QUICK_ACTIONS: {
  label: string;
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  tone?: "accent" | "blue" | "supreme";
}[] = [
  {
    label: "Live TV",
    caption: "Watch now",
    icon: "tv-outline",
    route: "/live-tv",
    tone: "blue",
  },
  {
    label: "Music",
    caption: "Your sound",
    icon: "musical-notes-outline",
    route: "/music",
    tone: "accent",
  },
  {
    label: "Video",
    caption: "Watch & import",
    icon: "film-outline",
    route: "/video-player",
    tone: "supreme",
  },
  {
    label: "Reels",
    caption: "Vertical shorts",
    icon: "play-circle-outline",
    route: "/reels",
    tone: "accent",
  },
  {
    label: "Imagine",
    caption: "Generate art",
    icon: "sparkles",
    route: "/(tabs)/studio",
    tone: "accent",
  },
  {
    label: "AI chat",
    caption: "Start an idea",
    icon: "chatbubbles-outline",
    route: "/(tabs)/ai",
    tone: "blue",
  },
  {
    label: "Discover",
    caption: "Explore walls",
    icon: "compass-outline",
    route: "/(tabs)/discover",
  },
  {
    label: "Space",
    caption: "Your world",
    icon: "apps-outline",
    route: "/space",
    tone: "supreme",
  },
  {
    label: "Downloads",
    caption: "Offline walls",
    icon: "download-outline",
    route: "/downloads",
  },
  {
    label: "Projects",
    caption: "Build boards",
    icon: "folder-open-outline",
    route: "/projects",
  },
  {
    label: "Market",
    caption: "Creator packs",
    icon: "storefront-outline",
    route: "/marketplace",
  },
  {
    label: "Community",
    caption: "Creator feed",
    icon: "people-outline",
    route: "/community",
  },
  {
    label: "Showroom",
    caption: "Curated sets",
    icon: "grid-outline",
    route: "/showroom",
  },
  {
    label: "Builder",
    caption: "Websites",
    icon: "code-slash-outline",
    route: "/builder",
  },
  {
    label: "Uploads",
    caption: "Your moderations",
    icon: "cloud-upload-outline",
    route: "/my-uploads",
  },
  {
    label: "Verify",
    caption: "Badges & limits",
    icon: "shield-checkmark-outline",
    route: "/verification",
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [popular, setPopular] = useState<Wallpaper[]>([]);
  const [fresh, setFresh] = useState<Wallpaper[]>([]);
  const [loved, setLoved] = useState<Wallpaper[]>([]);
  const [showrooms, setShowrooms] = useState<Showroom[]>([]);
  const [community, setCommunity] = useState<CommunityPost[]>([]);
  const [sites, setSites] = useState<PublicSite[]>([]);
  const [projects, setProjects] = useState<ShowcaseProject[]>([]);
  const [totals, setTotals] = useState({ wallpapers: 0, community: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date());
  const [showWelcome, setShowWelcome] = useState(false);
  const [liveChannels, setLiveChannels] = useState<IptvChannel[]>([]);
  const [reminders, setReminders] = useState<TvReminder[]>([]);
  const [showLivePopup, setShowLivePopup] = useState(false);

  const heroGlow = useSharedValue(0.55);
  const glowStyle = useAnimatedStyle(() => {
    "worklet";
    const glow = heroGlow.get();
    return { opacity: glow, transform: [{ scale: glow }] };
  });

  useEffect(() => {
    heroGlow.set(
      withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
  }, [heroGlow]);

  useEffect(() => {
    AsyncStorage.getItem(WELCOME_KEY)
      .then((seen) => {
        if (!seen) setShowWelcome(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!liveChannels.length || showWelcome) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    AsyncStorage.getItem(LIVE_POPUP_KEY)
      .then((seen) => {
        if (!seen) timer = setTimeout(() => setShowLivePopup(true), 1500);
      })
      .catch(() => {});
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [liveChannels.length, showWelcome]);

  const dismissLivePopup = () => {
    setShowLivePopup(false);
    AsyncStorage.setItem(LIVE_POPUP_KEY, "seen").catch(() => {});
  };

  const dismissWelcome = async (route?: string) => {
    setShowWelcome(false);
    await AsyncStorage.setItem(WELCOME_KEY, "seen").catch(() => {});
    if (route) router.push(route as never);
  };

  const load = useCallback(async () => {
    // Load live channels independently so a slow playlist never blocks the home feed.
    loadPlaylist()
      .then((result) => setLiveChannels(result.channels ?? []))
      .catch(() => {});
    listTvReminders()
      .then(setReminders)
      .catch(() => {});

    const [
      popularRes,
      freshRes,
      lovedRes,
      showroomRes,
      communityRes,
      sitesRes,
      projectsRes,
    ] = await Promise.allSettled([
      apiJson<Page<Wallpaper>>("/api/v1/wallpapers?sort=popular&limit=12"),
      apiJson<Page<Wallpaper>>("/api/v1/wallpapers?sort=newest&limit=12"),
      apiJson<Page<Wallpaper>>("/api/v1/wallpapers?sort=likes&limit=12"),
      apiJson<Page<Showroom>>("/api/v1/showroom?limit=8"),
      apiJson<Page<CommunityPost>>(
        "/api/v1/community/posts?sort=popular&limit=8",
      ),
      apiJson<{ sites: PublicSite[] }>("/api/v1/sites/public"),
      apiJson<Page<ShowcaseProject>>("/api/v1/projects/showcase?limit=8"),
    ]);

    const value = <T,>(res: PromiseSettledResult<T>): T | null =>
      res.status === "fulfilled" ? res.value : null;

    const p = value(popularRes);
    const f = value(freshRes);
    const l = value(lovedRes);
    const s = value(showroomRes);
    const c = value(communityRes);
    const siteData = value(sitesRes);
    const proj = value(projectsRes);

    if (p) {
      setPopular(p.items ?? []);
      setTotals((t) => ({
        ...t,
        wallpapers: p.pagination?.total ?? p.items?.length ?? 0,
      }));
    }
    if (f) setFresh(f.items ?? []);
    if (l) setLoved(l.items ?? []);
    if (s) setShowrooms(s.items ?? []);
    if (c) {
      setCommunity(c.items ?? []);
      setTotals((t) => ({
        ...t,
        community: c.pagination?.total ?? c.items?.length ?? 0,
      }));
    }
    if (siteData) setSites(siteData.sites ?? []);
    if (proj) setProjects(proj.items ?? []);
    setUpdatedAt(new Date());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
      const timer = setInterval(() => {
        load().catch(() => {});
      }, 45000);
      return () => clearInterval(timer);
    }, [load]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") load().catch(() => {});
    });
    return () => subscription.remove();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  const firstName = (user?.displayName ?? user?.name ?? "there").split(" ")[0];
  const tier = tierMeta(user?.verificationTier ?? "free");
  const hero = popular[0] ?? fresh[0] ?? loved[0] ?? null;

  const rails = useMemo(() => {
    const withNav = (w: Wallpaper, rank?: number): MediaItem => ({
      ...wallpaperCard(w, rank),
      onPress: () =>
        router.push({
          pathname: "/wallpaper/[slug]",
          params: { slug: w.slug },
        }),
    });
    const trending = popular.map((w, i) =>
      withNav(w, i < 3 ? i + 1 : undefined),
    );
    const freshCards = fresh.map((w) => withNav(w));
    const lovedCards = loved.map((w) => withNav(w));

    const showroomCards: MediaItem[] = showrooms.flatMap((room) =>
      (room.items ?? []).slice(0, 3).map((item, i) => ({
        id: `${room.username}-${item.id}-${i}`,
        title: item.caption ?? item.title ?? room.headline ?? room.username,
        imageUrl: imageOf(item.imageUrl),
        subtitle: room.headline ?? "WALLORA Showroom",
        creator: room.owner?.displayName ?? room.username,
        creatorTier: room.owner?.tier,
        badge: `${room.itemCount ?? room.items?.length ?? 0} PICKS`,
        accentColor: tierMeta(room.owner?.tier).color,
        onPress: () =>
          router.push({
            pathname: "/showroom/[username]",
            params: { username: room.username },
          }),
      })),
    );

    const communityCards: MediaItem[] = community
      .filter((post) => post.kind === "wallpaper" || post.imageUrl)
      .map((post) => ({
        id: post.id,
        title: post.body.length > 70 ? `${post.body.slice(0, 70)}…` : post.body,
        imageUrl: imageOf(post.imageUrl),
        subtitle: "Community post",
        creator: post.author?.displayName ?? post.author?.username,
        creatorTier: post.author?.tier,
        likes: post.likeCount ?? 0,
        badge:
          post.kind === "project"
            ? "PROJECT"
            : post.kind === "wallpaper"
              ? "WALLPAPER"
              : undefined,
        onPress: () => router.push("/community"),
      }));

    const siteCards: MediaItem[] = sites.map((site) => ({
      id: site.id,
      title: site.title,
      imageUrl: "",
      subtitle: site.prompt,
      badge: "WEBSITE",
      accentColor: C.blue,
      onPress: () =>
        router.push({ pathname: "/builder", params: { site: site.id } }),
    }));

    const projectCards: MediaItem[] = projects.map((project) => ({
      id: project.id,
      title: project.name ?? "Creative project",
      imageUrl: imageOf(project.coverUrl),
      subtitle: project.description ?? "Project showcase",
      creator: project.owner?.displayName ?? project.owner?.username,
      creatorTier: project.owner?.tier,
      badge: "PROJECT",
      accentColor: tierMeta(project.owner?.tier).color,
      onPress: () =>
        router.push({ pathname: "/project/[id]", params: { id: project.id } }),
    }));

    const liveCards: MediaItem[] = liveChannels
      .slice(0, 14)
      .map((channel, i) => ({
        id: uniqueChannelId(channel),
        title: channel.name,
        imageUrl: channel.logo ?? "",
        subtitle: groupLabel(channel.group),
        badge: "LIVE",
        accentColor: LIVE_COLORS[i % LIVE_COLORS.length],
        onPress: () =>
          router.push({
            pathname: "/live-tv",
            params: { channel: uniqueChannelId(channel) },
          }),
      }));

    return {
      trending,
      freshCards,
      lovedCards,
      showroomCards,
      communityCards,
      siteCards,
      projectCards,
      liveCards,
    };
  }, [
    community,
    fresh,
    loved,
    liveChannels,
    popular,
    projects,
    router,
    showrooms,
    sites,
  ]);

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.accent}
          />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>W</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.brandName}>WALLORA</Text>
              <Text style={styles.brandTag}>Discover. Imagine. Create.</Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push("/(tabs)/profile")}
            style={({ pressed }) => [
              styles.avatarButton,
              pressed && styles.pressed,
            ]}
          >
            {user?.avatarUrl ? (
              <Image
                source={{ uri: assetUrl(user.avatarUrl) }}
                style={styles.avatarImage}
              />
            ) : (
              <Ionicons name="person" size={19} color={C.accent} />
            )}
          </Pressable>
        </View>

        <View style={styles.greetingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>YOUR CREATIVE DASHBOARD</Text>
            <Text style={styles.greeting}>
              Welcome, <Text style={styles.greetingAccent}>{firstName}</Text>
            </Text>
          </View>
          <VerifiedBadge tier={user?.verificationTier ?? "free"} size="lg" />
        </View>

        {/* Hero */}
        <Animated.View
          entering={FadeInDown.duration(500)}
          style={styles.heroWrap}
        >
          <Pressable
            onPress={() =>
              hero
                ? router.push({
                    pathname: "/wallpaper/[slug]",
                    params: { slug: hero.slug },
                  })
                : router.push("/(tabs)/discover")
            }
            style={({ pressed }) => [
              styles.hero,
              pressed && styles.heroPressed,
            ]}
          >
            {hero?.asset?.objectKey ? (
              <Image
                source={{ uri: imageOf(hero.asset.objectKey) }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={[C.raised, C.bgDeep]}
                style={StyleSheet.absoluteFill}
              />
            )}
            <LinearGradient
              colors={[
                "rgba(0,0,0,0.08)",
                "rgba(0,0,0,0.45)",
                "rgba(0,0,0,0.96)",
              ]}
              locations={[0, 0.42, 1]}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View
              style={[styles.heroGlow, glowStyle]}
              pointerEvents="none"
            />

            <View style={styles.heroTop}>
              <View style={styles.heroKicker}>
                <Ionicons name="sparkles" size={13} color={C.bg} />
                <Text style={styles.heroKickerText}>FEATURED ON WALLORA</Text>
              </View>
              {hero?.creator?.tier && (
                <VerifiedBadge tier={hero.creator.tier} size="sm" />
              )}
            </View>

            <View style={styles.heroBottom}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {hero?.title ?? "Your next great idea starts here"}
              </Text>
              <Text style={styles.heroDesc} numberOfLines={2}>
                {hero?.description ??
                  "Generate original artwork, explore real community drops and build a creative world that is yours."}
              </Text>
              <View style={styles.heroMeta}>
                {hero?.creator && (
                  <Text style={styles.heroCreator}>
                    by {hero.creator.displayName ?? hero.creator.username}
                  </Text>
                )}
                {typeof hero?.likeCount === "number" && (
                  <Text style={styles.heroStat}>
                    {count(hero.likeCount)} likes
                  </Text>
                )}
                <Text style={styles.heroStat}>
                  {count(totals.wallpapers)} walls
                </Text>
              </View>
              <View style={styles.heroActions}>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push("/(tabs)/studio");
                  }}
                  style={styles.heroPrimary}
                >
                  <Ionicons name="sparkles" size={16} color={C.bg} />
                  <Text style={styles.heroPrimaryText}>Imagine</Text>
                </Pressable>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push("/(tabs)/ai");
                  }}
                  style={styles.heroSecondary}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={16}
                    color={C.text}
                  />
                  <Text style={styles.heroSecondaryText}>Start an idea</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(90).duration(500)}
          style={styles.pulseCard}
        >
          <BlurView
            intensity={28}
            tint="dark"
            blurMethod="dimezisBlurViewSdk31Plus"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.pulseHeader}>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE WALLORA</Text>
            </View>
            <Text style={styles.updatedText}>
              Updated{" "}
              {updatedAt.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
          <View style={styles.statsRow}>
            <Stat
              icon="image-outline"
              value={count(totals.wallpapers)}
              label="Wallpapers"
            />
            <Stat
              icon="people-outline"
              value={count(totals.community)}
              label="Posts"
            />
            <Stat
              icon="grid-outline"
              value={String(showrooms.length)}
              label="Showrooms"
            />
            <Stat
              icon="globe-outline"
              value={String(sites.length)}
              label="Sites"
            />
          </View>
        </Animated.View>

        <UpcomingReminderRail
          reminders={reminders}
          channels={liveChannels}
          onWatch={(channelId) =>
            router.push({
              pathname: "/live-tv/player",
              params: { channel: channelId },
            })
          }
          onSeeAll={() => router.push("/live-tv/reminders")}
        />

        {/* Live TV — channels on air right now */}
        <MediaRail
          title="Live TV · on air now"
          subtitle={`${liveChannels.length.toLocaleString()} channels streaming · tap to watch`}
          items={rails.liveCards}
          onSeeAll={() => router.push("/live-tv")}
          width={210}
        />

        {/* Quick actions */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Your creative tools</Text>
            <Text style={styles.sectionSub}>
              Everything from the web app, in your pocket
            </Text>
          </View>
        </View>
        <View style={styles.actionGrid}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => router.push(action.route as never)}
              style={({ pressed }) => [
                styles.actionTile,
                pressed && styles.actionPressed,
              ]}
            >
              <View
                style={[
                  styles.actionIcon,
                  action.tone === "accent" && styles.actionIconAccent,
                  action.tone === "blue" && styles.actionIconBlue,
                  action.tone === "supreme" && styles.actionIconSupreme,
                ]}
              >
                <Ionicons
                  name={action.icon}
                  size={21}
                  color={action.tone ? C.bg : C.accent}
                />
              </View>
              <Text style={styles.actionLabel} numberOfLines={1}>
                {action.label}
              </Text>
              <Text style={styles.actionCaption} numberOfLines={1}>
                {action.caption}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Rails */}
        <MediaRail
          title="Trending now"
          subtitle="What the community is loving"
          items={rails.trending}
          onSeeAll={() => router.push("/(tabs)/discover")}
        />
        <MediaRail
          title="Fresh drops"
          subtitle="Approved wallpapers, newest first"
          items={rails.freshCards}
          onSeeAll={() => router.push("/(tabs)/discover")}
        />
        <MediaRail
          title="Most loved"
          subtitle="Saved and liked across WALLORA"
          items={rails.lovedCards}
          onSeeAll={() => router.push("/favorites")}
        />
        <MediaRail
          title="Creator showrooms"
          subtitle="Hand-picked sets from real profiles"
          items={rails.showroomCards}
          onSeeAll={() => router.push("/showroom")}
          width={230}
        />
        <MediaRail
          title="From the community"
          subtitle="Posts with real artwork"
          items={rails.communityCards}
          onSeeAll={() => router.push("/community")}
          width={250}
        />
        <MediaRail
          title="Websites built on WALLORA"
          subtitle="Live pages from the builder"
          items={rails.siteCards}
          onSeeAll={() => router.push("/builder")}
          width={240}
        />
        <MediaRail
          title="Projects in motion"
          subtitle="Public creative journeys"
          items={rails.projectCards}
          onSeeAll={() => router.push("/projects/showcase")}
          width={240}
        />

        <View style={styles.footer}>
          <View style={styles.logoSmall}>
            <Text style={styles.logoTextSmall}>W</Text>
          </View>
          <Text style={styles.footerText}>WALLORA</Text>
          <Text style={styles.footerSub}>Made for creators, everywhere.</Text>
        </View>
      </ScrollView>

      <Modal
        visible={showWelcome}
        transparent
        animationType="fade"
        onRequestClose={() => dismissWelcome()}
      >
        <View style={styles.modalBackdrop}>
          <Animated.View
            entering={FadeInDown.duration(280)}
            style={styles.modalCard}
          >
            <View style={styles.modalIcon}>
              <Ionicons name="sparkles" size={28} color={C.bg} />
            </View>
            <Text style={styles.modalEyebrow}>WELCOME TO WALLORA</Text>
            <Text style={styles.modalTitle}>
              Turn an idea into something real.
            </Text>
            <Text style={styles.modalBody}>
              Chat with AI, imagine original wallpapers, follow real creators
              and keep everything in your WALLORA Space. Your{" "}
              {tier.label.toLowerCase()} is active.
            </Text>
            <Pressable
              onPress={() => dismissWelcome("/(tabs)/studio")}
              style={styles.modalPrimary}
            >
              <Ionicons name="image-outline" size={17} color={C.bg} />
              <Text style={styles.modalPrimaryText}>Imagine an image</Text>
            </Pressable>
            <Pressable
              onPress={() => dismissWelcome("/(tabs)/ai")}
              style={styles.modalSecondary}
            >
              <Ionicons name="chatbubbles-outline" size={17} color={C.text} />
              <Text style={styles.modalSecondaryText}>
                Start an idea in AI chat
              </Text>
            </Pressable>
            <Pressable
              onPress={() => dismissWelcome()}
              hitSlop={10}
              style={styles.modalSkip}
            >
              <Text style={styles.modalSkipText}>Explore first</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      {showLivePopup && liveChannels.length > 0 && (
        <LiveNowModal
          channels={liveChannels}
          onClose={dismissLivePopup}
          onWatch={(channelId) => {
            dismissLivePopup();
            router.push({
              pathname: "/live-tv",
              params: channelId ? { channel: channelId } : {},
            });
          }}
        />
      )}
    </View>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={statStyles.wrap}>
      <Ionicons name={icon} size={17} color={C.accent} />
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", gap: 2 },
  value: { color: C.text, fontSize: 16, fontWeight: "800", marginTop: 2 },
  label: { color: C.muted, fontSize: 10 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 11 },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accent,
    ...SHADOW.glowGold,
  },
  logoText: { color: C.bg, fontSize: 22, fontWeight: "900" },
  brandName: {
    color: C.text,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 2,
  },
  brandTag: { color: C.muted, fontSize: 10, marginTop: 2 },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 40, height: 40 },
  pressed: { opacity: 0.7 },
  greetingRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  eyebrow: {
    color: C.accent,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  greeting: {
    color: C.text,
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  greetingAccent: { color: C.accent },
  heroWrap: { marginHorizontal: 16 },
  hero: {
    height: 330,
    borderRadius: R.xl,
    overflow: "hidden",
    backgroundColor: C.card,
    ...SHADOW.hero,
  },
  heroPressed: { transform: [{ scale: 0.99 }] },
  heroGlow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    right: -90,
    top: -90,
    backgroundColor: "rgba(215,184,121,0.18)",
  },
  heroTop: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroKicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.accent,
    borderRadius: R.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroKickerText: {
    color: C.bg,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  heroBottom: { position: "absolute", left: 16, right: 16, bottom: 16 },
  heroTitle: {
    color: C.white,
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 31,
    textShadowColor: "#000",
    textShadowRadius: 6,
  },
  heroDesc: {
    color: C.textSoft,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 7,
    textShadowColor: "#000",
    textShadowRadius: 4,
  },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  heroCreator: { color: C.accentBright, fontSize: 11, fontWeight: "700" },
  heroStat: { color: C.textSoft, fontSize: 11 },
  heroActions: { flexDirection: "row", gap: 9, marginTop: 15 },
  heroPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.accent,
    borderRadius: R.pill,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  heroPrimaryText: { color: C.bg, fontWeight: "800", fontSize: 13 },
  heroSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: R.pill,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  heroSecondaryText: { color: C.text, fontWeight: "700", fontSize: 13 },
  pulseCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.borderSoft,
    padding: 14,
    overflow: "hidden",
  },
  pulseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.successDim,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: R.pill,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  liveText: {
    color: C.success,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  updatedText: { color: C.muted, fontSize: 10 },
  statsRow: { flexDirection: "row" },
  sectionHeader: { paddingHorizontal: 16, marginTop: 26, marginBottom: 12 },
  sectionTitle: { color: C.text, fontSize: 18, fontWeight: "800" },
  sectionSub: { color: C.muted, fontSize: 12, marginTop: 3 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10 },
  actionTile: {
    width: "25%",
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: "center",
    borderRadius: R.md,
  },
  actionPressed: { backgroundColor: C.card },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  actionIconAccent: { backgroundColor: C.accent },
  actionIconBlue: { backgroundColor: C.blue },
  actionIconSupreme: { backgroundColor: C.supreme },
  actionLabel: { color: C.text, fontSize: 12, fontWeight: "700" },
  actionCaption: { color: C.muted, fontSize: 9.5, marginTop: 2 },
  footer: { alignItems: "center", marginTop: 34, gap: 3 },
  logoSmall: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  logoTextSmall: { color: C.accent, fontWeight: "900", fontSize: 15 },
  footerText: {
    color: C.textSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 5,
  },
  footerSub: { color: C.muted, fontSize: 10 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "center",
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
    ...SHADOW.hero,
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalEyebrow: {
    color: C.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  modalTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
    marginTop: 8,
  },
  modalBody: { color: C.textSoft, fontSize: 13, lineHeight: 20, marginTop: 10 },
  modalPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: R.md,
    paddingVertical: 14,
    marginTop: 20,
  },
  modalPrimaryText: { color: C.bg, fontWeight: "800", fontSize: 14 },
  modalSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 13,
    marginTop: 10,
  },
  modalSecondaryText: { color: C.text, fontWeight: "700", fontSize: 13 },
  modalSkip: { alignSelf: "center", marginTop: 16, padding: 6 },
  modalSkipText: { color: C.muted, fontSize: 12 },
});
