import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { tierMeta, R } from "../../lib/theme";

/**
 * Tier badge that is actually legible on a phone.
 * Uses a colored pill + icon + label instead of a tiny invisible tick.
 */
export function VerifiedBadge({
  tier,
  size = "md",
  showLabel = true,
}: {
  tier?: string | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}) {
  const meta = tierMeta(tier);
  if (size === "sm" && !showLabel) {
    return (
      <View style={[styles.dot, { backgroundColor: meta.dim }]}>
        <Ionicons name="checkmark-circle" size={12} color={meta.color} />
      </View>
    );
  }
  const fontSize = size === "lg" ? 12 : size === "sm" ? 9 : 10;
  const iconSize = size === "lg" ? 15 : size === "sm" ? 11 : 12;
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: meta.dim, borderColor: meta.color + "55" },
        size === "lg" && styles.pillLg,
      ]}
    >
      <Ionicons name="checkmark-circle" size={iconSize} color={meta.color} />
      {showLabel && (
        <Text style={[styles.label, { color: meta.color, fontSize }]}>{meta.short}</Text>
      )}
    </View>
  );
}

/** Compact inline tick next to a name — larger and tier-colored. */
export function TierTick({
  tier,
  size = 16,
}: {
  tier?: string | null;
  size?: number;
}) {
  const meta = tierMeta(tier);
  return <Ionicons name="checkmark-circle" size={size} color={meta.color} />;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: R.pill,
    borderWidth: 1,
  },
  pillLg: { paddingHorizontal: 10, paddingVertical: 5, gap: 6 },
  label: { fontWeight: "800", letterSpacing: 0.6 },
  dot: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
