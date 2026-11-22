import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { C, R } from "../../lib/theme";

export function Notice({
  message,
  tone = "success",
  onDismiss,
}: {
  message: string | null;
  tone?: "success" | "error" | "info";
  onDismiss?: () => void;
}) {
  useEffect(() => {
    if (!message || !onDismiss) return;
    const t = setTimeout(onDismiss, 3200);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;
  const color = tone === "error" ? C.error : tone === "info" ? C.blue : C.success;
  const icon = tone === "error" ? "alert-circle" : tone === "info" ? "information-circle" : "checkmark-circle";
  return (
    <Animated.View entering={FadeInDown} exiting={FadeOutUp} style={[styles.toast, { borderColor: color + "55" }]}>
      <Ionicons name={icon as never} size={18} color={color} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

export function NoticeHost({ children }: { children: React.ReactNode }) {
  return <View style={StyleSheet.absoluteFill}>{children}</View>;
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute", left: 16, right: 16, top: 16, zIndex: 999,
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.bgElevated, borderWidth: 1, borderRadius: R.md,
    paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 16, elevation: 12,
  },
  text: { flex: 1, color: C.text, fontSize: 13, fontWeight: "600" },
});
