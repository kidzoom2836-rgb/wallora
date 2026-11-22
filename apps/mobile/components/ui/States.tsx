import { View, Text, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { C, R } from "../../lib/theme";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={C.accent} size="large" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon = "sparkles-outline",
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={28} color={C.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
      {actionLabel && onAction && (
        <Pressable onPress={onAction} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="alert-circle-outline"
      title="Something went wrong"
      message={message}
      actionLabel={onRetry ? "Try again" : undefined}
      onAction={onRetry}
    />
  );
}

export function SectionTitle({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{actionLabel} ›</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.pressed,
      ]}
    >
      {icon && <Ionicons name={icon} size={13} color={active ? C.bg : C.muted} />}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: C.accentDim,
    alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  title: { fontSize: 16, fontWeight: "700", color: C.text, textAlign: "center" },
  message: { fontSize: 13, color: C.muted, textAlign: "center", marginTop: 6, lineHeight: 19 },
  label: { fontSize: 13, color: C.muted, marginTop: 12 },
  action: { marginTop: 18, backgroundColor: C.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: R.pill },
  actionText: { color: C.bg, fontWeight: "700", fontSize: 13 },
  pressed: { opacity: 0.7 },
  sectionRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 12, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: C.text, letterSpacing: 0.3 },
  sectionSubtitle: { fontSize: 12, color: C.muted, marginTop: 2 },
  sectionAction: { fontSize: 12, color: C.accent, fontWeight: "600" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.pill,
    backgroundColor: C.raised, borderWidth: 1, borderColor: C.border,
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { fontSize: 12, color: C.muted, fontWeight: "600" },
  chipTextActive: { color: C.bg },
});
