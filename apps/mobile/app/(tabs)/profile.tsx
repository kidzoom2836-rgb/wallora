import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const C = { bg: "#0B0C0F", card: "#14161B", text: "#F7F7F5", muted: "#9296A1", accent: "#D7B879", border: "#292C33" };

export default function ProfileScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color={C.bg} />
          </View>
          <Text style={styles.name}>WALLORA User</Text>
          <Text style={styles.handle}>@wallora</Text>
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statNum}>0</Text><Text style={styles.statLabel}>Posts</Text></View>
          <View style={styles.stat}><Text style={styles.statNum}>0</Text><Text style={styles.statLabel}>Followers</Text></View>
          <View style={styles.stat}><Text style={styles.statNum}>0</Text><Text style={styles.statLabel}>Following</Text></View>
        </View>
        {[
          { icon: "settings-outline" as const, title: "Settings", desc: "Account, privacy, AI preferences" },
          { icon: "bookmark-outline" as const, title: "My Space", desc: "Saved wallpapers and generated images" },
          { icon: "folder-outline" as const, title: "Projects", desc: "Your creative projects" },
          { icon: "notifications-outline" as const, title: "Notifications", desc: "Activity and alerts" },
        ].map((item) => (
          <Pressable key={item.title} style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name={item.icon} size={20} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowDesc}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.muted} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  header: { alignItems: "center", marginTop: 40, marginBottom: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  name: { fontSize: 20, fontWeight: "600", color: C.text },
  handle: { fontSize: 14, color: C.muted, marginTop: 2 },
  stats: { flexDirection: "row", justifyContent: "space-around", marginVertical: 20, backgroundColor: C.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.border },
  stat: { alignItems: "center" },
  statNum: { fontSize: 18, fontWeight: "bold", color: C.text },
  statLabel: { fontSize: 12, color: C.muted, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#1C1F26", alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 14, fontWeight: "600", color: C.text },
  rowDesc: { fontSize: 12, color: C.muted, marginTop: 2 },
});
