import { View, Text, StyleSheet, ScrollView, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { apiJson } from "../../lib/api";
import { assetUrl } from "../../lib/config";

const C = { bg: "#0B0C0F", card: "#14161B", raised: "#1C1F26", text: "#F7F7F5", muted: "#9296A1", accent: "#D7B879", border: "#292C33", error: "#E46F75" };

interface ProfileStats {
  followers: number;
  following: number;
  wallpapers: number;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  verified: boolean;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<ProfileStats | null>(null);

  useEffect(() => {
    if (!user?.username) return;
    apiJson<any>(`/api/v1/users/${user.username}`)
      .then((d) => setStats({
        followers: d.stats?.followers ?? 0,
        following: d.stats?.following ?? 0,
        wallpapers: d.stats?.wallpapers ?? 0,
        displayName: d.displayName,
        bio: d.bio,
        avatarUrl: d.avatarUrl,
        verified: !!d.verified,
      }))
      .catch(() => {});
  }, [user?.username]);

  const rows = [
    { icon: "bookmark-outline" as const, title: "My Space", desc: "Saved wallpapers", route: "/favorites" },
    { icon: "cloud-upload-outline" as const, title: "My Uploads", desc: "Your published wallpapers", route: "/my-uploads" },
    { icon: "folder-outline" as const, title: "Projects", desc: "Your creative projects", route: "/projects" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Text style={styles.topTitle}>Profile</Text>
          <View style={styles.roleBadge}><Text style={styles.roleText}>{user?.role ?? "user"}</Text></View>
        </View>

        <View style={styles.header}>
          <View style={styles.avatar}>
            {stats?.avatarUrl || user?.avatarUrl ? (
              <ImageAvatar uri={assetUrl(stats?.avatarUrl ?? user?.avatarUrl)} />
            ) : (
              <Text style={styles.avatarText}>{(user?.name ?? "W").slice(0, 1).toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.identity}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{stats?.displayName ?? user?.name ?? "WALLORA User"}</Text>
              {stats?.verified && <Ionicons name="checkmark-circle" size={16} color={C.accent} />}
            </View>
            <Text style={styles.handle}>@{user?.username ?? "wallora"}</Text>
          </View>
        </View>

        {stats?.bio && <Text style={styles.bio}>{stats.bio}</Text>}

        <View style={styles.stats}>
          <Stat num={stats?.wallpapers ?? 0} label="Wallpapers" />
          <Stat num={stats?.followers ?? 0} label="Followers" />
          <Stat num={stats?.following ?? 0} label="Following" />
        </View>

        <Text style={styles.sectionTitle}>YOUR SPACE</Text>
        {rows.map((item) => (
          <Pressable key={item.title} style={styles.row} onPress={() => router.push(item.route as any)}>
            <View style={styles.rowIcon}><Ionicons name={item.icon} size={20} color={C.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowDesc}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.muted} />
          </Pressable>
        ))}

        <View style={styles.divider} />

        <Pressable style={styles.row} onPress={() => router.push("/(tabs)/studio")}>
          <View style={styles.rowIcon}><Ionicons name="color-wand-outline" size={20} color={C.accent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>AI Studio</Text>
            <Text style={styles.rowDesc}>Generate original artwork</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.muted} />
        </Pressable>

        <Pressable style={[styles.row, { marginTop: 16 }]} onPress={async () => { await signOut(); router.replace("/auth/login"); }}>
          <View style={[styles.rowIcon, { backgroundColor: "rgba(228,111,117,0.1)" }]}>
            <Ionicons name="log-out-outline" size={20} color={C.error} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: C.error }]}>Sign out</Text>
          </View>
        </Pressable>

        <Text style={styles.footer}>WALLORA · where imagination lives</Text>
      </ScrollView>
    </View>
  );
}

function Stat({ num, label }: { num: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNum}>{num}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ImageAvatar({ uri }: { uri?: string }) {
  if (!uri) return <View style={styles.avatarImageFallback} />;
  return <Image source={{ uri }} style={styles.avatarImage} />;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, paddingTop: 56 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  topTitle: { color: C.text, fontSize: 24, fontWeight: "800" },
  roleBadge: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  roleText: { color: C.accent, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  header: { flexDirection: "row", alignItems: "center", gap: 15 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: 76, height: 76 },
  avatarImageFallback: { width: 76, height: 76, backgroundColor: C.accent },
  avatarText: { fontSize: 30, fontWeight: "800", color: C.bg },
  identity: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { color: C.text, fontSize: 19, fontWeight: "700" },
  handle: { color: C.muted, fontSize: 13, marginTop: 3 },
  bio: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 14 },
  stats: { flexDirection: "row", backgroundColor: C.card, borderRadius: 14, padding: 16, marginTop: 20, borderWidth: 1, borderColor: C.border },
  stat: { flex: 1, alignItems: "center" },
  statNum: { color: C.text, fontSize: 19, fontWeight: "800" },
  statLabel: { color: C.muted, fontSize: 11, marginTop: 3 },
  sectionTitle: { color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginTop: 26, marginBottom: 11 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: 12, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  rowIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: C.raised, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: C.text, fontSize: 14, fontWeight: "700" },
  rowDesc: { color: C.muted, fontSize: 11, marginTop: 2 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  footer: { color: C.muted, fontSize: 11, textAlign: "center", marginTop: 26 },
});
