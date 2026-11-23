import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { C, R } from "../../lib/theme";

/**
 * Realtime "tuning" state for WALLORA TV. Uses a radar sweep, pulsing brand
 * mark, and animated signal bars so buffering reads as an active search
 * rather than a frozen spinner.
 */
export function TvSignalSearching({
  label = "SEARCHING SIGNAL",
  detail = "Locking onto the WALLORA TV stream…",
  channelName,
  attempt = 0,
  compact = false,
}: {
  label?: string;
  detail?: string;
  channelName?: string;
  attempt?: number;
  compact?: boolean;
}) {
  const [glow] = useState(() => new Animated.Value(0.35));
  const [rings] = useState(
    () => [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)],
  );
  const [dots, setDots] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      setDots((current) => (current.length >= 3 ? "" : `${current}.`));
    }, 420);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const easing = Easing.inOut(Easing.quad);
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 850, easing, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.35, duration: 850, easing, useNativeDriver: true }),
      ]),
    );
    const radar = rings.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 560),
          Animated.timing(value, { toValue: 1, duration: 1680, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    pulse.start();
    radar.forEach((animation) => animation.start());
    return () => {
      pulse.stop();
      radar.forEach((animation) => animation.stop());
    };
  }, [glow, rings]);

  const ringStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] }),
    transform: [
      {
        scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.35] }),
      },
    ],
  });

  const barOpacity = (index: number) =>
    glow.interpolate({
      inputRange: [0.35, 1],
      outputRange: [0.25 + index * 0.13, 0.65 + index * 0.11],
    });

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]} pointerEvents="none">
      <View style={styles.radar}>
        <Animated.View style={[styles.ring, ringStyle(rings[0])]} />
        <Animated.View style={[styles.ring, ringStyle(rings[1])]} />
        <Animated.View style={[styles.ring, ringStyle(rings[2])]} />
        <Animated.View
          style={[
            styles.logoGlow,
            {
              opacity: glow,
              transform: [{ scale: glow.interpolate({ inputRange: [0.35, 1], outputRange: [0.94, 1.06] }) }],
            },
          ]}
        >
          <View style={styles.logo}>
            <Ionicons name="tv-outline" size={compact ? 26 : 32} color={C.accent} />
            <Text style={[styles.brand, compact && styles.brandCompact]}>WALLORA TV</Text>
          </View>
        </Animated.View>
      </View>

      <View style={styles.signalRow}>
        {[0, 1, 2, 3].map((index) => (
          <Animated.View
            key={index}
            style={[styles.signalBar, { height: 5 + index * 4, opacity: barOpacity(index) }]}
          />
        ))}
      </View>

      <Text style={[styles.label, compact && styles.labelCompact]}>{label}{dots}</Text>
      {!!channelName && (
        <Text style={styles.channel} numberOfLines={1}>
          {channelName}
        </Text>
      )}
      <Text style={styles.detail} numberOfLines={2}>
        {detail}
      </Text>
      {attempt > 0 && (
        <View style={styles.attemptPill}>
          <Ionicons name="refresh-outline" size={10} color={C.accent} />
          <Text style={styles.attemptText}>Tuning attempt {attempt}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
  },
  wrapCompact: { paddingHorizontal: 18 },
  radar: {
    width: 172,
    height: 172,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  ring: {
    position: "absolute",
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 1.5,
    borderColor: C.accent,
  },
  logoGlow: {
    width: 106,
    height: 106,
    borderRadius: 53,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accent + "77",
    shadowColor: C.accent,
    shadowRadius: 24,
    shadowOpacity: 0.35,
  },
  logo: { alignItems: "center", justifyContent: "center", gap: 2 },
  brand: {
    color: C.accentBright,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  brandCompact: { fontSize: 9, letterSpacing: 1.4 },
  signalRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 20,
    marginBottom: 8,
  },
  signalBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: C.accent,
  },
  label: {
    color: C.white,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.6,
    textAlign: "center",
  },
  labelCompact: { fontSize: 11 },
  channel: {
    color: C.accentBright,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5,
    textAlign: "center",
  },
  detail: {
    color: C.textSoft,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
    textAlign: "center",
  },
  attemptPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.accent + "44",
    backgroundColor: C.accentDim,
  },
  attemptText: { color: C.accent, fontSize: 9.5, fontWeight: "800" },
});
