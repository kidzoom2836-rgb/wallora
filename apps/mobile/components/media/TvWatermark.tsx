import { StyleSheet, Text, View } from "react-native";

import { C, R } from "../../lib/theme";

const FILL = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

/** Non-interactive branding mark drawn over the live player. */
export function TvWatermark({
  channelName,
  compact = false,
}: {
  channelName?: string;
  compact?: boolean;
}) {
  return (
    <View style={FILL} pointerEvents="none">
      <View style={[styles.mark, compact && styles.markCompact]}>
        <View style={styles.liveDot} />
        <View style={styles.copy}>
          <Text style={styles.brand}>WALLORA TV</Text>
          {!!channelName && (
            <Text style={styles.channel} numberOfLines={1}>
              {channelName}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    position: "absolute",
    right: 12,
    bottom: 56,
    maxWidth: "52%",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: R.pill,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  markCompact: { bottom: 46, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF4D4D",
    shadowColor: "#FF4D4D",
    shadowRadius: 5,
    shadowOpacity: 0.8,
  },
  copy: { flexShrink: 1 },
  brand: {
    color: C.white,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
    opacity: 0.9,
  },
  channel: {
    color: C.textSoft,
    fontSize: 9,
    fontWeight: "600",
    marginTop: 1,
    opacity: 0.82,
  },
});
