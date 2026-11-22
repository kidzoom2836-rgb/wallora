import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, useLocalSearchParams } from "expo-router";

import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Chip, EmptyState, ErrorState, LoadingState, SectionTitle } from "../../components/ui/States";
import { VerifiedBadge } from "../../components/ui/VerifiedBadge";
import { apiJson } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { assetUrl } from "../../lib/config";
import { C, R, S, SHADOW, tierMeta } from "../../lib/theme";
import { withVerification } from "../../lib/verification";

type PublicProfile = {
  username: string;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  verified?: boolean;
  tier?: string | null;
  creatorStatus?: string | null;
  createdAt?: string;
  stats?: { followers?: number; following?: number; wallpapers?: number };
  isFollowing?: boolean;
  isSelf?: boolean;
};

type Wallpaper = {
  id: string;
  slug: string;
  title: string;
  likeCount?: number;
  downloadCount?: number;
  asset?: { objectKey: string } | null;
};

type Project = {
  id: string;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  owner?: { username?: string | null; displayName?: string | null } | null;
};

type ProjectList = Project[] | { items?: Project[] };

type Notice = { text: string; tone: "success" | "error" | "info" };

function projectItems(data: ProjectList): Project[] {
  return Array.isArray(data) ? data : data?.items ?? [];
}

/**
 * `/api/v1/projects?creator=` is attempted first where supported. The current
 * web API ignores that filter, so only items that explicitly name this creator
 * are kept; otherwise the public showcase feed (used by the web profile) is
 * filtered by owner. An empty result simply hides the projects tab content.
 */
async function loadCreatorProjects(username: string): Promise<Project[]> {
  try {
    const direct = await apiJson<ProjectList>(
      `/api/v1/projects?creator=${encodeURIComponent(username)}`,
    );
    const owned = projectItems(direct).filter((item) => item.owner?.username === username);
    if (owned.length > 0) return owned;
  } catch {
    // Endpoint may require verification or not support the creator filter.
  }

  try {
    const showcase = await apiJson<{ items?: Project[] }>("/api/v1/projects/showcase?limit=36");
    return (showcase?.items ?? []).filter((item) => item.owner?.username === username);
  } catch {
    return [];
  }
}

function joinedLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function Banner({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  const color =
    notice.tone === "success" ? C.success : notice.tone === "info" ? C.blue : C.error;
  const icon =
    notice.tone === "success"
      ? "checkmark-circle-outline"
      : notice.tone === "info"
        ? "information-circle-outline"
        : "alert-circle-outline";
  return (
    <View style={[styles.banner, { borderColor: color + "55" }]}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.bannerText, { color }]}>{notice.text}</Text>
    </View>
  );
}

export default function PublicProfileScreen() {
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const username = Array.isArray(params.username) ? params.username[0] : params.username ?? "";
  const { user } = useAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tab, setTab] = useState<"wallpapers" | "projects">("wallpapers");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wallpaperError, setWallpaperError] = useState<string | null>(null);
  const [followingBusy, setFollowingBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    if (!username) {
      setError("No creator was specified.");
      setLoading(false);
      return;
    }
    setError(null);
    setWallpaperError(null);
    setNotice(null);

    const handle = encodeURIComponent(username);
    const [profileResult, wallpapersResult, projectsResult] = await Promise.allSettled([
      apiJson<PublicProfile>(`/api/v1/users/${handle}`),
      apiJson<{ items?: Wallpaper[] }>(`/api/v1/wallpapers?creator=${handle}&limit=24`),
      loadCreatorProjects(username),
    ]);

    if (profileResult.status === "fulfilled") {
      setProfile(profileResult.value);
    } else {
      setError(profileResult.reason?.message ?? "This profile could not be loaded.");
      setProfile(null);
    }
    if (wallpapersResult.status === "fulfilled") {
      setWallpapers(wallpapersResult.value.items ?? []);
    } else {
      setWallpapers([]);
      setWallpaperError(wallpapersResult.reason?.message ?? "Could not load wallpapers.");
    }
    setProjects(projectsResult.status === "fulfilled" ? projectsResult.value : []);

    setLoading(false);
    setRefreshing(false);
  }, [username]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const toggleFollow = async () => {
    if (!profile || profile.isSelf || !user || followingBusy) return;
    setFollowingBusy(true);
    setNotice(null);
    try {
      const next = await withVerification(async () => {
        await apiJson(`/api/v1/users/${encodeURIComponent(profile.username)}/follow`, {
          method: profile.isFollowing ? "DELETE" : "POST",
        });
        return !profile.isFollowing;
      });
      if (typeof next !== "boolean") {
        setNotice({
          text: "Claim your free WALLORA tick to follow creators.",
          tone: "info",
        });
        return;
      }
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: next,
              stats: {
                ...prev.stats,
                followers: Math.max(0, (prev.stats?.followers ?? 0) + (next ? 1 : -1)),
              },
            }
          : prev,
      );
    } catch (e: any) {
      setNotice({
        text: e?.message ?? (profile.isFollowing ? "Could not unfollow this creator." : "Could not follow this creator."),
        tone: "error",
      });
    } finally {
      setFollowingBusy(false);
    }
  };

  const tier = tierMeta(profile?.tier ?? "free");
  const avatarRef = profile?.avatarUrl ? assetUrl(profile.avatarUrl) : undefined;
  const coverRef = profile?.coverUrl ? assetUrl(profile.coverUrl) : undefined;
  const displayName = profile?.displayName ?? profile?.username ?? username ?? "WALLORA creator";

  return (
    <View style={styles.root}>
      <ScreenHeader title="Creator profile" subtitle={profile ? `@${profile.username}` : `@${username}`} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={C.accent} />}
        contentContainerStyle={styles.content}
      >
        <Banner notice={notice} />

        {loading ? <LoadingState label="Loading this creator…" /> : null}

        {!loading && (error || !profile) ? (
          <ErrorState
            message={error ?? "This profile does not exist or is no longer active."}
            onRetry={() => { setLoading(true); void load(); }}
          />
        ) : null}

        {!loading && profile ? (
          <>
            <View style={styles.cover}>
              {coverRef ? (
                <Image source={{ uri: coverRef }} style={styles.coverImage} resizeMode="cover" />
              ) : (
                <View style={styles.coverFallback}>
                  <Ionicons name="image-outline" size={28} color={C.mutedDark} />
                </View>
              )}
              <View style={styles.coverFade} />
            </View>

            <View style={styles.identity}>
              <View style={[styles.avatar, { borderColor: tier.color }]}>
                {avatarRef ? (
                  <Image source={{ uri: avatarRef }} style={styles.avatarImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.avatarInitial}>{displayName.slice(0, 1).toUpperCase()}</Text>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <VerifiedBadge tier={profile.tier} size="sm" />
                </View>
                <Text style={styles.handle}>@{profile.username}</Text>
                <View style={[styles.tierPill, { borderColor: tier.color + "66" }]}>
                  <Ionicons name="shield-checkmark-outline" size={11} color={tier.color} />
                  <Text style={[styles.tierText, { color: tier.color }]}>{tier.label}</Text>
                </View>
                {joinedLabel(profile.createdAt) ? (
                  <Text style={styles.joined}>Joined {joinedLabel(profile.createdAt)}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.actions}>
              {profile.isSelf ? (
                <Link href="/settings" asChild>
                  <Pressable style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
                    <Ionicons name="settings-outline" size={16} color={C.accent} />
                    <Text style={styles.actionText}>Edit profile</Text>
                  </Pressable>
                </Link>
              ) : user ? (
                <Pressable
                  onPress={() => void toggleFollow()}
                  disabled={followingBusy}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.actionPrimary,
                    pressed && styles.pressed,
                    followingBusy && styles.buttonDisabled,
                  ]}
                >
                  {followingBusy ? (
                    <ActivityIndicator color={C.bg} size="small" />
                  ) : (
                    <Ionicons
                      name={profile.isFollowing ? "checkmark-outline" : "person-add-outline"}
                      size={16}
                      color={C.bg}
                    />
                  )}
                  <Text style={[styles.actionText, styles.actionPrimaryText]}>
                    {profile.isFollowing ? "Following" : "Follow"}
                  </Text>
                </Pressable>
              ) : (
                <Link href="/auth/login" asChild>
                  <Pressable style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
                    <Ionicons name="log-in-outline" size={16} color={C.accent} />
                    <Text style={styles.actionText}>Sign in to follow</Text>
                  </Pressable>
                </Link>
              )}

              <Link
                href={{ pathname: "/showroom/[username]", params: { username: profile.username } }}
                asChild
              >
                <Pressable style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
                  <Ionicons name="grid-outline" size={16} color={C.accent} />
                  <Text style={styles.actionText}>Showroom</Text>
                </Pressable>
              </Link>
            </View>

            <View style={styles.card}>
              <Text style={styles.bio}>
                {profile.bio?.trim() || "This creator has not written a bio yet."}
              </Text>
              <View style={styles.statsRow}>
                <Stat value={profile.stats?.wallpapers ?? 0} label="Wallpapers" />
                <Stat value={profile.stats?.followers ?? 0} label="Followers" />
                <Stat value={profile.stats?.following ?? 0} label="Following" />
              </View>
            </View>

            <View style={styles.tabs}>
              <Chip
                label="Wallpapers"
                icon="grid-outline"
                active={tab === "wallpapers"}
                onPress={() => setTab("wallpapers")}
              />
              <Chip
                label="Projects"
                icon="folder-outline"
                active={tab === "projects"}
                onPress={() => setTab("projects")}
              />
            </View>

            {tab === "wallpapers" ? (
              <>
                <SectionTitle
                  title="Public wallpapers"
                  subtitle={`Approved work shared by @${profile.username}`}
                />
                {wallpaperError ? <ErrorState message={wallpaperError} onRetry={() => void load()} /> : null}
                {!wallpaperError && wallpapers.length === 0 ? (
                  <EmptyState icon="images-outline" title="No public wallpapers yet" />
                ) : null}
                {!wallpaperError && wallpapers.length > 0 ? (
                  <View style={styles.grid}>
                    {wallpapers.map((wallpaper) => (
                      <Link
                        key={wallpaper.id}
                        href={{ pathname: "/wallpaper/[slug]", params: { slug: wallpaper.slug } }}
                        asChild
                      >
                        <Pressable style={({ pressed }) => [styles.wallCard, pressed && styles.pressed]}>
                          {wallpaper.asset?.objectKey ? (
                            <Image
                              source={{ uri: assetUrl(wallpaper.asset.objectKey) }}
                              style={styles.wallImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.wallFallback}>
                              <Ionicons name="image-outline" size={24} color={C.mutedDark} />
                            </View>
                          )}
                          <View style={styles.wallOverlay}>
                            <Text style={styles.wallTitle} numberOfLines={2}>
                              {wallpaper.title}
                            </Text>
                            <View style={styles.wallMeta}>
                              <Text style={styles.wallStat}>
                                <Ionicons name="heart-outline" size={10} color={C.text} /> {wallpaper.likeCount ?? 0}
                              </Text>
                              <Text style={styles.wallStat}>
                                <Ionicons name="download-outline" size={10} color={C.text} /> {wallpaper.downloadCount ?? 0}
                              </Text>
                            </View>
                          </View>
                        </Pressable>
                      </Link>
                    ))}
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <SectionTitle title="Public projects" subtitle="Projects this creator has shared" />
                {projects.length === 0 ? (
                  <EmptyState
                    icon="folder-outline"
                    title="No public projects yet"
                    message="Shared creative projects will appear here."
                  />
                ) : (
                  projects.map((project) => (
                    <Link
                      key={project.id}
                      href={{ pathname: "/project/[id]", params: { id: project.id } }}
                      asChild
                    >
                      <Pressable style={({ pressed }) => [styles.projectCard, pressed && styles.pressed]}>
                        <View style={styles.projectThumb}>
                          {assetUrl(project.coverUrl) ? (
                            <Image
                              source={{ uri: assetUrl(project.coverUrl) }}
                              style={styles.projectThumbImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <Ionicons name="folder-outline" size={20} color={C.accent} />
                          )}
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.projectName} numberOfLines={1}>
                            {project.name ?? project.title ?? "Creative project"}
                          </Text>
                          <Text style={styles.projectDescription} numberOfLines={2}>
                            {project.description?.trim() || "A WALLORA creative project."}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={17} color={C.muted} />
                      </Pressable>
                    </Link>
                  ))
                )}
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={statStyles.wrap}>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center" },
  value: { color: C.text, fontSize: 17, fontWeight: "800" },
  label: { color: C.muted, fontSize: 10, marginTop: 2 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: S.xxxl },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: S.sm,
    margin: S.lg,
    marginBottom: 0,
    padding: S.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderRadius: R.md,
  },
  bannerText: { flex: 1, fontSize: 12, lineHeight: 18 },
  cover: { height: 150, backgroundColor: C.raised, overflow: "hidden" },
  coverImage: { width: "100%", height: "100%" },
  coverFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  coverFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
    backgroundColor: "rgba(11,12,15,0.85)",
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.md,
    paddingHorizontal: S.lg,
    marginTop: -30,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...SHADOW.glowGold,
  },
  avatarImage: { width: 82, height: 82 },
  avatarInitial: { color: C.accent, fontSize: 30, fontWeight: "800" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { color: C.text, fontSize: 18, fontWeight: "800", flexShrink: 1 },
  handle: { color: C.muted, fontSize: 12, marginTop: 2 },
  tierPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: R.pill,
    backgroundColor: C.bg,
    borderWidth: 1,
  },
  tierText: { fontSize: 10, fontWeight: "800" },
  joined: { color: C.mutedDark, fontSize: 10, marginTop: 5 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: S.sm, paddingHorizontal: S.lg, marginTop: S.lg },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: S.md,
    paddingVertical: 10,
    borderRadius: R.pill,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  actionPrimary: { backgroundColor: C.accent, borderColor: C.accent },
  actionText: { color: C.textSoft, fontSize: 12, fontWeight: "800" },
  actionPrimaryText: { color: C.bg },
  buttonDisabled: { opacity: 0.6 },
  pressed: { opacity: 0.7 },
  card: {
    margin: S.lg,
    marginTop: S.md,
    padding: S.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
  },
  bio: { color: C.textSoft, fontSize: 13, lineHeight: 20 },
  statsRow: { flexDirection: "row", marginTop: S.md, paddingTop: S.md, borderTopWidth: 1, borderTopColor: C.borderSoft },
  tabs: { flexDirection: "row", gap: S.sm, paddingHorizontal: S.lg, marginTop: S.sm, marginBottom: S.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: S.sm, paddingHorizontal: S.lg, marginTop: S.sm },
  wallCard: {
    width: "47%",
    height: 150,
    borderRadius: R.md,
    overflow: "hidden",
    backgroundColor: C.raised,
  },
  wallImage: { width: "100%", height: "100%" },
  wallFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  wallOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 8, backgroundColor: "rgba(0,0,0,0.75)" },
  wallTitle: { color: C.text, fontSize: 11, fontWeight: "700" },
  wallMeta: { flexDirection: "row", gap: 10, marginTop: 4 },
  wallStat: { color: C.textSoft, fontSize: 9 },
  projectCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.md,
    marginHorizontal: S.lg,
    marginBottom: S.sm,
    padding: S.sm,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
  },
  projectThumb: {
    width: 54,
    height: 54,
    borderRadius: R.sm,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  projectThumbImage: { width: 54, height: 54 },
  projectName: { color: C.text, fontSize: 13, fontWeight: "700" },
  projectDescription: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
});
