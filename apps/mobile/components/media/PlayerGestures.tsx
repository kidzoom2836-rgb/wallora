import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Animated,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  GestureDetector,
  useCompetingGestures,
  useLongPressGesture,
  usePanGesture,
  useTapGesture,
} from "react-native-gesture-handler";

import { C, R } from "../../lib/theme";

type Indicator =
  | { kind: "brightness" | "volume"; value: number }
  | { kind: "seek"; direction: -1 | 1 }
  | { kind: "boost" }
  | { kind: "zap"; direction: -1 | 0 | 1 }
  | null;

/** Invisible player gestures with compact, self-clearing feedback. */
export function PlayerGestures({
  children,
  enabled,
  zappingEnabled,
  brightness,
  volume,
  onBrightness,
  onVolume,
  onSeek,
  onBoostStart,
  onBoostEnd,
  onZap,
  onTap,
}: {
  children: ReactNode;
  enabled: boolean;
  zappingEnabled: boolean;
  brightness: number;
  volume: number;
  onBrightness: (value: number) => void;
  onVolume: (value: number) => void;
  onSeek: (seconds: number) => void;
  onBoostStart: () => void;
  onBoostEnd: () => void;
  onZap: (direction: -1 | 1) => void;
  onTap: () => void;
}) {
  const { width } = useWindowDimensions();
  const [indicator, setIndicator] = useState<Indicator>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef<{ at: number; side: -1 | 1 } | null>(null);
  const panMode = useRef<"brightness" | "volume" | "zap" | null>(null);
  const startValue = useRef(0);
  const lastTranslationY = useRef(0);
  const boosting = useRef(false);
  const ripple = useMemo(() => new Animated.Value(0), []);

  const clearIndicator = useCallback(() => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = null;
    setIndicator(null);
  }, []);

  const showIndicator = useCallback(
    (next: Exclude<Indicator, null>, duration = 1100) => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      setIndicator(next);
      clearTimer.current = setTimeout(() => {
        clearTimer.current = null;
        setIndicator(null);
      }, duration);
    },
    [clearTimer],
  );

  useEffect(() => {
    if (indicator?.kind !== "seek") return;
    ripple.setValue(0);
    Animated.timing(ripple, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [indicator, ripple]);

  useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  const tapGesture = useTapGesture({
    enabled,
    runOnJS: true,
    maxDuration: 280,
    onActivate: (event) => {
      onTap();
      const side: -1 | 1 = event.absoluteX < width / 2 ? -1 : 1;
      const now = Date.now();
      const previous = lastTap.current;
      if (previous && now - previous.at < 330 && previous.side === side) {
        if (tapTimer.current) clearTimeout(tapTimer.current);
        tapTimer.current = null;
        lastTap.current = null;
        onSeek(side * 10);
        showIndicator({ kind: "seek", direction: side });
        return;
      }
      lastTap.current = { at: now, side };
      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapTimer.current = setTimeout(() => {
        tapTimer.current = null;
        lastTap.current = null;
      }, 340);
    },
  });

  const panGesture = usePanGesture({
    enabled,
    runOnJS: true,
    activeOffsetY: 8,
    failOffsetX: 28,
    shouldCancelWhenOutside: true,
    onActivate: (event) => {
      lastTranslationY.current = 0;
      if (event.absoluteX < width * 0.34) {
        panMode.current = "brightness";
        startValue.current = brightness;
        showIndicator({ kind: "brightness", value: brightness });
      } else if (event.absoluteX > width * 0.66) {
        panMode.current = "volume";
        startValue.current = volume;
        showIndicator({ kind: "volume", value: volume });
      } else if (zappingEnabled) {
        panMode.current = "zap";
        showIndicator({ kind: "zap", direction: 0 });
      } else {
        panMode.current = null;
      }
    },
    onUpdate: (event) => {
      const mode = panMode.current;
      if (!mode) return;
      lastTranslationY.current = event.translationY;
      if (mode === "brightness" || mode === "volume") {
        const next = Math.min(1, Math.max(0, startValue.current - event.translationY / 220));
        if (mode === "brightness") onBrightness(next);
        else onVolume(next);
        showIndicator({ kind: mode, value: next }, 900);
      } else {
        const direction = event.translationY < -28 ? 1 : event.translationY > 28 ? -1 : 0;
        showIndicator({ kind: "zap", direction }, 900);
      }
    },
    onDeactivate: () => {
      const mode = panMode.current;
      panMode.current = null;
      if (mode === "zap") {
        const translation = lastTranslationY.current;
        if (translation < -70) onZap(1);
        else if (translation > 70) onZap(-1);
      }
      clearIndicator();
    },
    onFinalize: () => {
      panMode.current = null;
    },
  });

  const longPressGesture = useLongPressGesture({
    enabled,
    runOnJS: true,
    minDuration: 350,
    maxDistance: 18,
    onActivate: () => {
      boosting.current = true;
      onBoostStart();
      showIndicator({ kind: "boost" }, 4000);
    },
    onFinalize: () => {
      if (!boosting.current) return;
      boosting.current = false;
      onBoostEnd();
      clearIndicator();
    },
  });

  const gesture = useCompetingGestures(tapGesture, panGesture, longPressGesture);

  return (
    <GestureDetector gesture={gesture}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {children}

        {(indicator?.kind === "brightness" || indicator?.kind === "volume") && (
          <View
            pointerEvents="none"
            style={[
              styles.pillTrack,
              indicator.kind === "brightness" ? styles.pillLeft : styles.pillRight,
            ]}
          >
            <Ionicons
              name={indicator.kind === "brightness" ? "sunny" : "volume-high"}
              size={17}
              color={C.accent}
            />
            <View style={styles.pillMeter}>
              <View
                style={[
                  styles.pillFill,
                  { height: `${Math.round(indicator.value * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.pillValue}>{Math.round(indicator.value * 100)}%</Text>
          </View>
        )}

        {indicator?.kind === "seek" && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.centerBadge,
              {
                opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }),
                transform: [
                  {
                    scale: ripple.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.86, 1.12],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons
              name={indicator.direction === 1 ? "play-forward" : "play-back"}
              size={22}
              color={C.bg}
            />
            <Text style={styles.centerBadgeText}>10s</Text>
          </Animated.View>
        )}

        {indicator?.kind === "boost" && (
          <View pointerEvents="none" style={styles.centerBadge}>
            <Ionicons name="flash" size={18} color={C.bg} />
            <Text style={styles.centerBadgeText}>2× BOOST</Text>
          </View>
        )}

        {indicator?.kind === "zap" && (
          <View pointerEvents="none" style={styles.centerBadge}>
            <Ionicons
              name={indicator.direction === 1 ? "arrow-up" : indicator.direction === -1 ? "arrow-down" : "swap-vertical"}
              size={18}
              color={C.bg}
            />
            <Text style={styles.centerBadgeText}>
              {indicator.direction === 1
                ? "NEXT CHANNEL"
                : indicator.direction === -1
                  ? "PREVIOUS CHANNEL"
                  : "SWIPE TO ZAP"}
            </Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  pillTrack: {
    position: "absolute",
    top: "32%",
    width: 44,
    height: 170,
    borderRadius: R.lg,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    backgroundColor: "rgba(8,9,12,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  pillLeft: { left: 16 },
  pillRight: { right: 16 },
  pillMeter: {
    width: 6,
    height: 92,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.16)",
    justifyContent: "flex-end",
  },
  pillFill: { width: "100%", borderRadius: 3, backgroundColor: C.accent },
  pillValue: { color: C.white, fontSize: 10, fontWeight: "900" },
  centerBadge: {
    position: "absolute",
    alignSelf: "center",
    top: "42%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: R.pill,
    backgroundColor: C.accent,
  },
  centerBadgeText: { color: C.bg, fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },
});
