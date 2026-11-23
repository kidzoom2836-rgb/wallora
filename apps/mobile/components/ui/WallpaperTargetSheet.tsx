import type { ComponentProps } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { C, R, SHADOW } from "../../lib/theme";

export type WallpaperTarget = "home" | "lock" | "both";

const OPTIONS: {
  id: WallpaperTarget;
  label: string;
  detail: string;
  icon: ComponentProps<typeof Ionicons>["name"];
}[] = [
  { id: "home", label: "Home screen", detail: "Apply to your home screen", icon: "home-outline" },
  { id: "lock", label: "Lock screen", detail: "Apply to your lock screen", icon: "lock-closed-outline" },
  { id: "both", label: "Both", detail: "Apply to home and lock screen", icon: "layers-outline" },
];

/**
 * Lets the user choose home / lock / both before we hand the saved image to
 * the Android wallpaper picker. Expo has no cross-platform API to set a
 * wallpaper directly, so the final apply step always happens in the OS viewer.
 */
export function WallpaperTargetSheet({
  visible,
  busy,
  onClose,
  onSelect,
}: {
  visible: boolean;
  busy?: boolean;
  onClose: () => void;
  onSelect: (target: WallpaperTarget) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} disabled={busy} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headingRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="image-outline" size={20} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Apply wallpaper</Text>
              <Text style={styles.subtitle}>Where should this wallpaper go?</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} disabled={busy}>
              <Ionicons name="close" size={20} color={C.muted} />
            </Pressable>
          </View>

          {OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => onSelect(option.id)}
              disabled={busy}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <View style={styles.optionIcon}>
                <Ionicons name={option.icon} size={18} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionDetail}>{option.detail}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.muted} />
            </Pressable>
          ))}

          <Text style={styles.note}>
            WALLORA saves the image to your WALLORA album and opens the Android wallpaper picker.
            Complete your choice there — Android does not let apps set wallpapers directly.
          </Text>
          {busy && (
            <View style={styles.busyRow}>
              <ActivityIndicator color={C.accent} size="small" />
              <Text style={styles.busyText}>Saving to your device…</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" },
  dismissArea: { flex: 1 },
  sheet: {
    backgroundColor: C.bgElevated,
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    borderTopWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    ...SHADOW.hero,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.raisedHover,
    marginBottom: 14,
  },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center" },
  title: { color: C.text, fontSize: 17, fontWeight: "800" },
  subtitle: { color: C.muted, fontSize: 11.5, marginTop: 2 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingVertical: 13,
    paddingHorizontal: 12,
    marginBottom: 9,
  },
  optionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center" },
  optionLabel: { color: C.text, fontSize: 13.5, fontWeight: "700" },
  optionDetail: { color: C.muted, fontSize: 10.5, marginTop: 2 },
  pressed: { opacity: 0.7 },
  note: { color: C.muted, fontSize: 10.5, lineHeight: 16, marginTop: 8 },
  busyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  busyText: { color: C.accent, fontSize: 11 },
});
