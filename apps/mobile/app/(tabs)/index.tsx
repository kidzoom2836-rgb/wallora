import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";

const C = {
  bg: "#0B0C0F",
  card: "#14161B",
  raised: "#1C1F26",
  text: "#F7F7F5",
  muted: "#9296A1",
  accent: "#D7B879",
  border: "#292C33",
  success: "#43B581",
};

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>W</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>WALLORA</Text>
              <Text style={styles.tagline}>Discover. Chat. Imagine. Create. Share. Earn.</Text>
            </View>
            <Pressable onPress={async () => { await signOut(); router.replace("/auth/login"); }} style={styles.signOutBtn}>
              <Ionicons name="log-out-outline" size={22} color={C.muted} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.hero}>Welcome back{user?.name ? `, ${user.name}` : ""}</Text>
        <Text style={styles.sub}>Discover inspiring visuals, talk to AI, create original artwork and build your creative world.</Text>

        <View style={styles.actions}>
          <Link href="/(tabs)/ai" asChild>
            <Pressable style={styles.primaryBtn}>
              <Ionicons name="sparkles" size={18} color={C.bg} />
              <Text style={styles.primaryBtnText}>Start creating</Text>
            </Pressable>
          </Link>
          <Link href="/(tabs)/discover" asChild>
            <Pressable style={styles.secondaryBtn}>
              <Ionicons name="compass-outline" size={18} color={C.text} />
              <Text style={styles.secondaryBtnText}>Explore artwork</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Creative tools</Text>
          {[
            { icon: "color-wand-outline" as const, title: "AI Studio", desc: "Generate original artwork from text" },
            { icon: "image-outline" as const, title: "Photo Studio", desc: "Enhance, crop and refine images" },
            { icon: "chatbubble-ellipses-outline" as const, title: "AI Chat", desc: "Converse with your creative assistant" },
            { icon: "folder-outline" as const, title: "Projects", desc: "Organize assets and ideas" },
          ].map((t) => (
            <View key={t.title} style={styles.toolRow}>
              <View style={styles.toolIcon}>
                <Ionicons name={t.icon} size={20} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.toolTitle}>{t.title}</Text>
                <Text style={styles.toolDesc}>{t.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How it works</Text>
          <View style={styles.steps}>
            {[
              { n: "01", title: "Imagine", desc: "Describe what you want" },
              { n: "02", title: "Create", desc: "AI picks the right tool" },
              { n: "03", title: "Refine", desc: "Iterate and perfect" },
              { n: "04", title: "Share", desc: "Publish or sell" },
            ].map((s) => (
              <View key={s.n} style={styles.step}>
                <Text style={styles.stepNum}>{s.n}</Text>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.stepDesc}>{s.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={16} color={C.muted} />
          <Text style={styles.noteText}>Full experience available on web. Mobile UI in progress.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20 },
  logoWrap: { flexDirection: "row", alignItems: "center", gap: 12 },
  signOutBtn: { padding: 8 },
  logo: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 22, fontWeight: "bold", color: C.bg },
  title: { fontSize: 20, fontWeight: "bold", color: C.text, letterSpacing: 2 },
  tagline: { fontSize: 10, color: C.muted, marginTop: 2 },
  hero: { fontSize: 24, fontWeight: "600", color: C.text, marginTop: 16, lineHeight: 30 },
  sub: { fontSize: 14, color: C.muted, marginTop: 8, lineHeight: 20 },
  actions: { gap: 12, marginTop: 20 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.accent, paddingVertical: 14, borderRadius: 12 },
  primaryBtnText: { color: C.bg, fontWeight: "600", fontSize: 16 },
  secondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: C.border, paddingVertical: 14, borderRadius: 12 },
  secondaryBtnText: { color: C.text, fontWeight: "500", fontSize: 16 },
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: C.text, marginBottom: 12 },
  toolRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  toolIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.raised, alignItems: "center", justifyContent: "center" },
  toolTitle: { fontSize: 14, fontWeight: "600", color: C.text },
  toolDesc: { fontSize: 12, color: C.muted, marginTop: 2 },
  steps: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  step: { width: "48%", backgroundColor: C.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
  stepNum: { fontSize: 11, color: C.accent, fontWeight: "700", marginBottom: 4 },
  stepTitle: { fontSize: 14, fontWeight: "600", color: C.text },
  stepDesc: { fontSize: 11, color: C.muted, marginTop: 2 },
  note: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 24, padding: 12, backgroundColor: C.card, borderRadius: 8 },
  noteText: { fontSize: 12, color: C.muted, flex: 1 },
});
