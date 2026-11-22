import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { apiFetch, apiJson } from "../../lib/api";
import { assetUrl } from "../../lib/config";
import { useAuth } from "../../lib/auth";
import { C, R, SHADOW, tierMeta } from "../../lib/theme";
import { VerifiedBadge } from "../../components/ui/VerifiedBadge";
import { SectionTitle } from "../../components/ui/States";

interface ProfileStats {
  followers: number;
  following: number;
  wallpapers: number;
  displayName: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  verified: boolean;
  tier?: string | null;
}

interface Wallpaper {
  id: string;
  slug: string;
  title: string;
  likeCount?: number;
  downloadCount?: number;
  asset?: { objectKey: string } | null;
}

export default function ProfileScreen() {
  const { user, signOut, refresh } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    if (!user?.username) return;
    const [profile, walls] = await Promise.allSettled([
      apiJson<any>(`/api/v1/users/${user.username}`),
      apiJson<{ items: Wallpaper[] }>(`/api/v1/users/${user.username}/wallpapers?limit=12`),
    ]);
    if (profile.status === "fulfilled") {
      const d = profile.value;
      setStats({
        followers: d.stats?.followers ?? 0,
        following: d.stats?.following ?? 0,
        wallpapers: d.stats?.wallpapers ?? 0,
        displayName: d.displayName ?? d.name ?? user.displayName ?? user.name ?? "Creator",
        username: d.username ?? user.username!,
        bio: d.bio,
        avatarUrl: d.avatarUrl,
        verified: !!d.verified,
        tier: d.tier ?? d.verificationTier,
      });
    }
    if (walls.status === "fulfilled") setWallpapers(walls.value.items ?? []);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    await refresh();
    setRefreshing(false);
  };

  const doSignOut = async () => {
    setSigningOut(true);
    try {
      await apiFetch("/api/v1/auth/signout", { method: "POST" }).catch(() => {});
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const tier = tierMeta(stats?.tier ?? user?.verificationTier ?? "free");

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          {loading ? (
            <ActivityIndicator color={C.accent} size="large" />
          ) : (
            <>
              <View style={styles.avatarWrap}>
                {stats?.avatarUrl || user?.avatarUrl ? (
                  <Image source={{ uri: assetUrl(stats?.avatarUrl ?? user?.avatarUrl) }} style={styles.avatar} />
                ) : (
                  <Ionicons name="person" size={36} color={C.accent} />
                )}
              </View>
              <View style={styles.identity}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{stats?.displayName ?? user?.displayName ?? user?.name}</Text>
                  <VerifiedBadge tier={stats?.tier ?? user?.verificationTier ?? "free"} size="md" />
                </View>
                <Text style={styles.handle}>@{stats?.username ?? user?.username}</Text>
                <View style={[styles.tierPill, { borderColor: tier.color + "66" }]}>
                  <Ionicons name="shield-checkmark-outline" size={12} color={tier.color} />
                  <Text style={[styles.tierText, { color: tier.color }]}>{tier.label}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.statsRow}>
            <Stat value={stats?.wallpapers ?? 0} label="Wallpapers" icon="image-outline" />
            <Stat value={stats?.followers ?? 0} label="Followers" icon="people-outline" />
            <Stat value={stats?.following ?? 0} label="Following" icon="person-add-outline" />
          </View>

          {stats?.bio && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>ABOUT</Text>
              <Text style={styles.bio}>{stats.bio}</Text>
            </View>
          )}

          <View style={styles.menuGrid}>
            <MenuTile icon="apps-outline" label="Your Space" onPress={() => router.push("/(tabs)/space")} />
            <MenuTile icon="download-outline" label="Downloads" onPress={() => router.push("/downloads")} />
            <MenuTile icon="shield-checkmark-outline" label="Verification" onPress={() => router.push("/verification")} />
            <MenuTile icon="settings-outline" label="Settings" onPress={() => router.push("/settings")} />
            <MenuTile icon="cloud-upload-outline" label="Uploads" onPress={() => router.push("/my-uploads")} />
            <MenuTile icon="code-slash-outline" label="Builder" onPress={() => router.push("/builder")} />
            <MenuTile icon="storefront-outline" label="Market" onPress={() => router.push("/marketplace")} />
            <MenuTile icon="people-outline" label="Community" onPress={() => router.push("/community")} />
          </View>

          <SectionTitle title="Your wallpapers" subtitle="Artwork published from this account" />

          {wallpapers.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="images-outline" size={30} color={C.muted} />
              <Text style={styles.emptyTitle}>No wallpapers yet</Text>
              <Text style={styles.emptyText}>Generate in Studio or upload from WALLORA on the web.</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {wallpapers.map((w) => (
                <Pressable
                  key={w.id}
                  onPress={() => router.push({ pathname: "/wallpaper/[slug]", params: { slug: w.slug } })}
                  style={({ pressed }) => [styles.wallCard, pressed && styles.pressed]}
                >
                  {w.asset?.objectKey && (
                    <Image source={{ uri: assetUrl(w.asset.objectKey) }} style={styles.wallImage} resizeMode="cover" />
                  )}
                  <View style={styles.wallOverlay}>
                    <Text style={styles.wallTitle} numberOfLines={2}>{w.title}</Text>
                    <View style={styles.wallMeta}>
                      <Text style={styles.wallStat}><Ionicons name="heart-outline" size={10} color={C.text} /> {w.likeCount ?? 0}</Text>
                      <Text style={styles.wallStat}><Ionicons name="download-outline" size={10} color={C.text} /> {w.downloadCount ?? 0}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable onPress={doSignOut} disabled={signingOut} style={styles.signOut}>
            {signingOut ? <ActivityIndicator color={C.error} size="small" /> : <Ionicons name="log-out-outline" size={18} color={C.error} />}
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label, icon }: { value: number; label: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={statStyles.wrap}>
      <Ionicons name={icon} size={17} color={C.accent} />
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

function MenuTile({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuTile, pressed && styles.pressed]}>
      <Ionicons name={icon} size={19} color={C.accent} />
      <Text style={styles.menuLabel}>{label}</Text>
    </Pressable>
  );
}

const statStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", gap: 3 },
  value: { color: C.text, fontSize: 18, fontWeight: "800" },
  label: { color: C.muted, fontSize: 10 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  hero: { minHeight: 200, padding: 20, paddingTop: 26, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  heroGlow: { position: "absolute", width: 260, height: 260, borderRadius: 130, backgroundColor: "rgba(215,184,121,0.12)", top: -150 },
  avatarWrap: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.raised, borderWidth: 2, borderColor: C.accent, alignItems: "center", justifyContent: "center", overflow: "hidden", ...SHADOW.glowGold },
  avatar: { width: 76, height: 76 },
  identity: { alignItems: "center", marginTop: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  name: { color: C.text, fontSize: 19, fontWeight: "800" },
  handle: { color: C.muted, fontSize: 12, marginTop: 2 },
  tierPill: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 9, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill, borderWidth: 1, backgroundColor: C.bg },
  tierText: { fontSize: 10, fontWeight: "800" },
  body: { padding: 16 },
  statsRow: { flexDirection: "row", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, paddingVertical: 15, marginBottom: 14 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, padding: 14, marginBottom: 14 },
  cardLabel: { color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.3, marginBottom: 7 },
  bio: { color: C.textSoft, fontSize: 13, lineHeight: 19 },
  menuGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 22 },
  menuTile: { width: "30%", minHeight: 70, borderRadius: R.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", gap: 7 },
  menuLabel: { color: C.textSoft, fontSize: 11, fontWeight: "700", textAlign: "center" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8, backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border },
  emptyTitle: { color: C.text, fontSize: 15, fontWeight: "700" },
  emptyText: { color: C.muted, fontSize: 12, textAlign: "center", paddingHorizontal: 30 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  wallCard: { width: "47%", height: 150, borderRadius: R.md, overflow: "hidden", backgroundColor: C.raised },
  wallImage: { width: "100%", height: "100%" },
  wallOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 9, backgroundColor: "rgba(0,0,0,0.75)" },
  wallTitle: { color: C.text, fontSize: 11, fontWeight: "700" },
  wallMeta: { flexDirection: "row", gap: 10, marginTop: 4 },
  wallStat: { color: C.textSoft, fontSize: 9 },
  pressed: { opacity: 0.7 },
  signOut: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 26, paddingVertical: 14, borderRadius: R.md, borderWidth: 1, borderColor: C.error + "55", backgroundColor: C.errorDim },
  signOutText: { color: C.error, fontSize: 14, fontWeight: "700" },
});
