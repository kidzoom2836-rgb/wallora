import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { C, R } from "../../lib/theme";

/** Consistent header with real safe-area handling and optional back button. */
export function ScreenHeader({
  title,
  subtitle,
  right,
  showBack = true,
  transparent = false,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  showBack?: boolean;
  transparent?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top + 10 },
        !transparent && styles.solid,
      ]}
    >
      <View style={styles.row}>
        {showBack && (
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  solid: { backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.borderSoft },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: {
    width: 38,
    height: 38,
    borderRadius: R.md,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.7 },
  title: { fontSize: 20, fontWeight: "700", color: C.text, letterSpacing: 0.3 },
  subtitle: { fontSize: 12, color: C.muted, marginTop: 2 },
});
