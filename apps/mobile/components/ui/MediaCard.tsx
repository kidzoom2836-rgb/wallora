import { View, Text, Image, Pressable, StyleSheet, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { C, R, SHADOW } from "../../lib/theme";
import { TierTick } from "./VerifiedBadge";

const { width: SW } = Dimensions.get("window");

export type MediaItem = {
  id: string;
  title: string;
  imageUrl: string;
  subtitle?: string;
  creator?: string;
  creatorTier?: string | null;
  likes?: number;
  downloads?: number;
  rank?: number;
  badge?: string;
  accentColor?: string;
  href?: string;
  onPress?: () => void;
};

/** Netflix-style landscape card with exposed edges handled by the rail. */
export function MediaCard({
  item,
  width = SW * 0.56,
  height = 168,
  variant = "landscape",
}: {
  item: MediaItem;
  width?: number;
  height?: number;
  variant?: "landscape" | "poster";
}) {
  return (
    <Pressable
      onPress={item.onPress}
      style={({ pressed }) => [
        styles.card,
        { width, height: variant === "poster" ? height * 1.42 : height },
        pressed && styles.pressed,
      ]}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: item.accentColor ?? C.card }]} />
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.18)", "rgba(0,0,0,0.93)"]}
        locations={[0, 0.38, 1]}
        style={StyleSheet.absoluteFill}
      />
      {typeof item.rank === "number" && (
        <View style={styles.rankWrap}>
          <Text style={styles.rankNum}>{item.rank}</Text>
        </View>
      )}
      {item.badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.badge}</Text>
        </View>
      )}
      <View style={styles.bottom}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        {(item.creator || item.subtitle) && (
          <View style={styles.metaRow}>
            {item.creator && (
              <Text style={styles.creator} numberOfLines={1}>
                {item.creator}
              </Text>
            )}
            {item.creatorTier && <TierTick tier={item.creatorTier} size={13} />}
            {typeof item.likes === "number" && (
              <View style={styles.stat}>
                <Ionicons name="heart-outline" size={11} color={C.textSoft} />
                <Text style={styles.statText}>{formatCount(item.likes)}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

const styles = StyleSheet.create({
  card: {
    borderRadius: R.lg,
    overflow: "hidden",
    backgroundColor: C.card,
    ...SHADOW.card,
  },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  rankWrap: { position: "absolute", left: 8, top: 8, alignItems: "center" },
  rankNum: { fontSize: 40, fontWeight: "900", color: C.white, textShadowColor: "#000", textShadowRadius: 8 },
  badge: {
    position: "absolute", top: 10, right: 10,
    backgroundColor: C.accent, borderRadius: R.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeText: { fontSize: 9, fontWeight: "800", color: C.bg, letterSpacing: 0.5 },
  bottom: { position: "absolute", left: 10, right: 10, bottom: 10 },
  title: { fontSize: 14, fontWeight: "800", color: C.white, textShadowColor: "#000", textShadowRadius: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  creator: { fontSize: 11, color: C.textSoft, maxWidth: "55%" },
  stat: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: "auto" },
  statText: { fontSize: 10, color: C.textSoft, fontWeight: "600" },
});
