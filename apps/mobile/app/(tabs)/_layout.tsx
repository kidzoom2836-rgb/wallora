import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const C = {
  bg: "#0B0C0F",
  card: "#14161B",
  text: "#F7F7F5",
  muted: "#9296A1",
  accent: "#D7B879",
  border: "#292C33",
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border, borderTopWidth: 1, height: 60, paddingBottom: 8 },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color as string} /> }} />
      <Tabs.Screen name="discover" options={{ title: "Discover", tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" size={size} color={color as string} /> }} />
      <Tabs.Screen name="ai" options={{ title: "AI Chat", tabBarIcon: ({ color, size }) => <Ionicons name="sparkles-outline" size={size} color={color as string} /> }} />
      <Tabs.Screen name="studio" options={{ title: "Studio", tabBarIcon: ({ color, size }) => <Ionicons name="color-wand-outline" size={size} color={color as string} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color as string} /> }} />
    </Tabs>
  );
}
