import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
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

import { apiJson } from "../../lib/api";
import { API_BASE, assetUrl } from "../../lib/config";
import { useAuth } from "../../lib/auth";
import { readDownloads } from "../../lib/downloads";
import { C, R } from "../../lib/theme";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Chip, EmptyState, SectionTitle } from "../../components/ui/States";
import { VerifiedBadge } from "../../components/ui/VerifiedBadge";

type Tab = "following" | "uploads" | "websites" | "saved" | "downloads";

const TABS: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "following", label: "Following", icon: "people-outline" },
  { id: "uploads", label: "Uploads", icon: "cloud-upload-outline" },
  { id: "websites", label: "Websites", icon: "globe-outline" },
  { id: "saved", label: "Saved", icon: "bookmark-outline" },
  { id: "downloads", label: "Downloads", icon: "download-outline" },
];

type CardItem = {
  id: string;
  title: string;
  imageUrl?: string;
  subtitle?: string;
  creator?: string;
  tier?: string | null;
  badge?: string;
  badgeColor?: string;
  onPress?: () => void;
};

type Creator = { username?: string; displayName?: string; tier?: string | null };
type Wallpaper = { id: string; slug: string; title: string; asset?: { objectKey: string } | null; creator?: Creator | null; createdAt?: string };
type Post = { id: string; body: string; imageUrl?: string | null; author?: Creator | null; createdAt?: string; kind?: string };
type Upload = { id: string; slug: string; title: string; status: string; assets?: { variant: string; objectKey: string }[]; createdAt: string };
type Favorite = { wallpaper: Wallpaper };
type Site = { id: string; slug: string; title: string; prompt: string; published?: boolean };
type Download = { id: string; title: string; localUri: string; creator?: string; createdAt: number };

const STATUS_COLOR: Record<string, string> = {
  approved: C.success,
  pending: C.accent,
  rejected: C.error,
  flagged: C.error,
};

export default function SpaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>("following");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followingCards, setFollowingCards] = useState<CardItem[]>([]);
  const [followedCount, setFollowedCount] = useState(0);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [publicSites, setPublicSites] = useState<Site[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadFollowing = useCallback(async () => {
    const [wallRes, postRes] = await Promise.allSettled([
      apiJson<{ items: Wallpaper[] }>("/api/v1/wallpapers?sort=newest&limit=12"),
      apiJson<{ items: Post[] }>("/api/v1/community/posts?sort=recent&limit=12"),
    ]);
    const walls = wallRes.status === "fulfilled" ? wallRes.value.items ?? [] : [];
    const posts = postRes.status === "fulfilled" ? postRes.value.items ?? [] : [];

    const usernames = Array.from(
      new Set(
        [
          ...walls.map((w) => w.creator?.username),
          ...posts.map((p) => p.author?.username),
        ].filter((name): name is string => !!name),
      ),
    ).slice(0, 10);

    const profiles = await Promise.all(
      usernames.map(async (username) => {
        try {
          const profile = await apiJson<any>(`/api/v1/users/${username}`);
          return { username, following: !!profile.isFollowing, profile };
        } catch {
          return { username, following: false, profile: null };
        }
      }),
    );
    const followed = new Set(profiles.filter((p) => p.following).map((p) => p.username));
    const profileMap = new Map(profiles.map((p) => [p.username, p.profile]));
    setFollowedCount(followed.size);

    const items: CardItem[] = [
      ...walls.map((w) => ({
        id: `w-${w.id}`,
        title: w.title,
        imageUrl: assetUrl(w.asset?.objectKey) ?? "",
        subtitle: w.creator?.displayName ?? w.creator?.username ?? "WALLORA creator",
        creator: w.creator?.displayName ?? w.creator?.username,
        tier: w.creator?.tier,
        badge: followed.has(w.creator?.username ?? "") ? "FOLLOWING" : "NEW",
        badgeColor: followed.has(w.creator?.username ?? "") ? C.success : C.accent,
        onPress: () => router.push({ pathname: "/wallpaper/[slug]", params: { slug: w.slug } }),
      })),
      ...posts
        .filter((p) => p.imageUrl)
        .map((p) => ({
          id: `p-${p.id}`,
          title: p.body.length > 70 ? `${p.body.slice(0, 70)}…` : p.body,
          imageUrl: assetUrl(p.imageUrl) ?? "",
          subtitle: "Community post",
          creator: p.author?.displayName ?? p.author?.username,
          tier: p.author?.tier ?? profileMap.get(p.author?.username ?? "")?.tier,
          badge: followed.has(p.author?.username ?? "") ? "FOLLOWING" : "COMMUNITY",
          badgeColor: followed.has(p.author?.username ?? "") ? C.success : C.blue,
          onPress: () => router.push("/community"),
        })),
    ];

    items.sort((a, b) => {
      const af = a.badge === "FOLLOWING" ? 1 : 0;
      const bf = b.badge === "FOLLOWING" ? 1 : 0;
      return bf - af;
    });
    setFollowingCards(items);
  }, [router]);

  const load = useCallback(async () => {
    setError(null);
    await loadFollowing().catch(() => {});

    if (user) {
      const [upRes, siteRes, favRes, ownSiteRes] = await Promise.allSettled([
        apiJson<{ items: Upload[] }>("/api/v1/users/me/wallpapers?limit=24"),
        apiJson<{ sites: Site[] }>("/api/v1/sites/public"),
        apiJson<{ items: Favorite[] }>("/api/v1/favorites?limit=24"),
        apiJson<{ sites: Site[] }>("/api/v1/sites"),
      ]);
      if (upRes.status === "fulfilled") setUploads(upRes.value.items ?? []);
      if (siteRes.status === "fulfilled") setPublicSites(siteRes.value.sites ?? []);
      if (favRes.status === "fulfilled") setFavorites(favRes.value.items ?? []);
      if (ownSiteRes.status === "fulfilled") setSites(ownSiteRes.value.sites ?? []);
    }
    setDownloads(await readDownloads());
  }, [loadFollowing, user]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const uploadCards: CardItem[] = uploads.map((u) => {
    const ref = u.assets?.find((a) => a.variant === "grid")?.objectKey ?? u.assets?.[0]?.objectKey;
    return {
      id: u.id,
      title: u.title,
      imageUrl: assetUrl(ref) ?? "",
      subtitle: new Date(u.createdAt).toLocaleDateString(),
      badge: u.status.toUpperCase(),
      badgeColor: STATUS_COLOR[u.status] ?? C.muted,
      onPress: () => router.push({ pathname: "/wallpaper/[slug]", params: { slug: u.slug } }),
    };
  });

  const savedCards: CardItem[] = favorites.map((f) => ({
    id: f.wallpaper.id,
    title: f.wallpaper.title,
    imageUrl: assetUrl(f.wallpaper.asset?.objectKey) ?? "",
    creator: f.wallpaper.creator?.displayName ?? f.wallpaper.creator?.username,
    tier: f.wallpaper.creator?.tier,
    badge: "SAVED",
    badgeColor: C.accent,
    onPress: () => router.push({ pathname: "/wallpaper/[slug]", params: { slug: f.wallpaper.slug } }),
  }));

  const websiteCards: CardItem[] = [
    ...sites.map((site) => ({
      id: `own-${site.id}`,
      title: site.title,
      subtitle: site.prompt,
      badge: site.published ? "PUBLISHED" : "DRAFT",
      badgeColor: site.published ? C.success : C.muted,
      onPress: () => Linking.openURL(`${API_BASE}/sites/${site.slug}`).catch(() => {}),
    })),
    ...publicSites.map((site) => ({
      id: `public-${site.id}`,
      title: site.title,
      subtitle: site.prompt,
      badge: "LIVE",
      badgeColor: C.blue,
      onPress: () => Linking.openURL(`${API_BASE}/sites/${site.slug}`).catch(() => {}),
    })),
  ];

  const downloadCards: CardItem[] = downloads.map((d) => ({
    id: d.id,
    title: d.title,
    imageUrl: d.localUri,
    subtitle: d.creator ?? "WALLORA download",
    badge: "OFFLINE",
    badgeColor: C.success,
    onPress: () => router.push("/downloads"),
  }));

  const activeCards =
    tab === "following"
      ? followingCards
      : tab === "uploads"
        ? uploadCards
        : tab === "websites"
          ? websiteCards
          : tab === "saved"
            ? savedCards
            : downloadCards;

  const title =
    tab === "following"
      ? followedCount > 0 ? "From creators you follow" : "Suggested creators"
      : tab === "uploads"
        ? "Your uploads"
        : tab === "websites"
          ? "Websites on WALLORA"
          : tab === "saved"
            ? "Saved wallpapers"
            : "WALLORA Downloads";

  const subtitle =
    tab === "following"
      ? followedCount > 0
        ? `${followedCount} followed uploader${followedCount === 1 ? "" : "s"} in this feed`
        : "Follow creators from any wallpaper to build this feed"
      : tab === "uploads"
        ? "Moderation status updates in real time"
        : tab === "websites"
          ? "Live pages built with WALLORA AI"
          : tab === "saved"
            ? "Wallpapers you bookmarked"
            : "Local wallpapers ready to apply";

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="WALLORA Space"
        subtitle="Your creative world, connected"
        showBack={false}
        right={
          <Pressable onPress={() => router.push("/settings")} hitSlop={10} style={styles.headerBtn}>
            <Ionicons name="settings-outline" size={19} color={C.text} />
          </Pressable>
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {TABS.map((t) => (
          <Chip
            key={t.id}
            label={t.label}
            icon={t.icon}
            active={tab === t.id}
            onPress={() => setTab(t.id)}
          />
        ))}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]}
      >
        <View style={styles.heroPanel}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroEyebrow}>YOUR SPACE</Text>
          <Text style={styles.heroTitle}>Everything you follow, save, build and download.</Text>
          <Text style={styles.heroText}>
            WALLORA Space brings real uploads, websites, saved walls and offline downloads into one dashboard.
          </Text>
          <View style={styles.heroStats}>
            <SpaceStat value={String(followedCount)} label="Following" />
            <SpaceStat value={String(uploads.length)} label="Uploads" />
            <SpaceStat value={String(websiteCards.length)} label="Sites" />
            <SpaceStat value={String(downloads.length)} label="Offline" />
          </View>
        </View>

        <SectionTitle title={title} subtitle={subtitle} />

        {error && <Text style={styles.error}>{error}</Text>}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={C.accent} size="large" />
          </View>
        ) : activeCards.length === 0 ? (
          <EmptyState
            icon={tab === "downloads" ? "download-outline" : tab === "saved" ? "bookmark-outline" : "sparkles-outline"}
            title="Nothing here yet"
            message={
              tab === "following"
                ? "Follow creators from Discover and their work will appear here first."
                : tab === "uploads"
                  ? "Upload wallpapers on WALLORA and track moderation here."
                  : tab === "websites"
                    ? "Build a website in WALLORA Studio and it will appear here."
                    : tab === "saved"
                      ? "Bookmark wallpapers to keep them in your Space."
                      : "Download a wallpaper to keep an offline copy."
            }
            actionLabel="Discover wallpapers"
            onAction={() => router.push("/(tabs)/discover")}
          />
        ) : (
          <View style={styles.grid}>
            {activeCards.map((item) => (
              <Pressable
                key={item.id}
                onPress={item.onPress}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <View style={styles.cardImageWrap}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.cardImage, { backgroundColor: item.badgeColor ?? C.raised }]}>
                      <Ionicons name="globe-outline" size={28} color={C.bg} />
                    </View>
                  )}
                  {item.badge && (
                    <View style={[styles.badge, { backgroundColor: item.badgeColor ?? C.accent }]}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {(item.subtitle || item.creator) && (
                    <View style={styles.creatorRow}>
                      <Text style={styles.cardSub} numberOfLines={1}>
                        {item.creator ?? item.subtitle}
                      </Text>
                      {item.tier && <VerifiedBadge tier={item.tier} size="sm" showLabel={false} />}
                    </View>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {tab === "uploads" && (
          <Pressable onPress={() => router.push("/my-uploads")} style={styles.fullCta}>
            <Ionicons name="cloud-upload-outline" size={17} color={C.accent} />
            <Text style={styles.fullCtaText}>Open full upload manager</Text>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </Pressable>
        )}
        {tab === "websites" && (
          <Pressable onPress={() => router.push("/sites")} style={styles.fullCta}>
            <Ionicons name="globe-outline" size={17} color={C.accent} />
            <Text style={styles.fullCtaText}>Explore all sites</Text>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function SpaceStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  headerBtn: { width: 38, height: 38, borderRadius: R.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  tabs: { gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borderSoft },
  content: { padding: 16 },
  heroPanel: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.xl, padding: 18, overflow: "hidden", marginBottom: 24 },
  heroGlow: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(185,140,255,0.14)", top: -100, right: -70 },
  heroEyebrow: { color: C.supreme, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  heroTitle: { color: C.text, fontSize: 19, fontWeight: "800", lineHeight: 25, marginTop: 8 },
  heroText: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  heroStats: { flexDirection: "row", marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border },
  stat: { flex: 1, alignItems: "center" },
  statValue: { color: C.text, fontSize: 16, fontWeight: "800" },
  statLabel: { color: C.muted, fontSize: 10, marginTop: 2 },
  error: { color: C.error, fontSize: 12, marginBottom: 10 },
  loading: { paddingVertical: 50, alignItems: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "47%", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, overflow: "hidden" },
  cardImageWrap: { height: 150, backgroundColor: C.raised },
  cardImage: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 8, left: 8, borderRadius: R.pill, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { color: C.bg, fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
  cardBody: { padding: 10 },
  cardTitle: { color: C.text, fontSize: 12.5, fontWeight: "700" },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  cardSub: { color: C.muted, fontSize: 10.5, flex: 1 },
  pressed: { opacity: 0.75 },
  fullCta: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 18, padding: 14, borderRadius: R.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  fullCtaText: { flex: 1, color: C.textSoft, fontSize: 12, fontWeight: "700" },
});
