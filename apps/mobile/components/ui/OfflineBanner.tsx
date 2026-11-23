import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import { useNetworkState } from "expo-network";
import { Ionicons } from "@expo/vector-icons";

import { C, R } from "../../lib/theme";
import { API_BASE } from "../../lib/config";

/**
 * Global connectivity banner. Uses expo-network's live network state and
 * hides on /downloads, where locally saved wallpapers stay usable offline.
 */
export function OfflineBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const network = useNetworkState();
  const [checking, setChecking] = useState(false);
  const [forceOnline, setForceOnline] = useState(false);

  const offline =
    !forceOnline &&
    (network.isConnected === false || network.isInternetReachable === false);

  const retry = useCallback(async () => {
    setChecking(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${API_BASE}/api/v1/health`, {
        signal: controller.signal,
        cache: "no-store",
      } as RequestInit);
      clearTimeout(timer);
      if (res.ok) setForceOnline(true);
    } catch {
      // The live network listener will clear the banner when connectivity returns.
    } finally {
      setChecking(false);
    }
  }, []);

  if (!offline || pathname === "/downloads") return null;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} pointerEvents="box-none">
      <View style={styles.banner} accessible role="alert">
        <Ionicons name="cloud-offline-outline" size={16} color={C.accentBright} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>You are currently offline</Text>
          <Text style={styles.subtitle}>Some content may not update.</Text>
        </View>
        <Pressable onPress={() => void retry()} disabled={checking} hitSlop={8} style={styles.action}>
          {checking ? (
            <Ionicons name="refresh" size={14} color={C.accentBright} />
          ) : (
            <Text style={styles.actionText}>Retry</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => router.push("/downloads")}
          hitSlop={8}
          style={[styles.action, styles.actionSolid]}
        >
          <Ionicons name="download-outline" size={13} color={C.bg} style={{ marginRight: 4 }} />
          <Text style={[styles.actionText, { color: C.bg }]}>Downloads</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 1000 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(28,24,16,0.96)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(215,184,121,0.32)",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  title: { color: C.accentBright, fontSize: 12, fontWeight: "800" },
  subtitle: { color: C.muted, fontSize: 10.5, marginTop: 1 },
  action: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: "rgba(215,184,121,0.4)",
    flexDirection: "row",
    alignItems: "center",
  },
  actionSolid: { backgroundColor: C.accent, borderColor: C.accent },
  actionText: { color: C.accentBright, fontSize: 10.5, fontWeight: "800" },
});
