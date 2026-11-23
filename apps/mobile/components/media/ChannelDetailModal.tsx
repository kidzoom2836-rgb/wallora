import { useEffect, useRef, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { C, R, SHADOW } from "../../lib/theme";
import { groupLabel, type IptvChannel } from "../../lib/iptv";

const FILL = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
const AUTO_WATCH_MS = 5000;

function initials(name: string) {
  return (
    name
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "TV"
  );
}

/** Netflix-style channel detail sheet with a 5-second auto-watch countdown. */
export function ChannelDetailModal({
  channel,
  visible,
  isFavorite = false,
  likes,
  rank,
  onClose,
  onWatch,
  onToggleFavorite,
  onRecommend,
  onMarkProgram,
}: {
  channel: IptvChannel | null;
  visible: boolean;
  isFavorite?: boolean;
  likes?: number;
  rank?: number;
  onClose: () => void;
  onWatch: () => void;
  onToggleFavorite: () => void;
  onRecommend: () => void;
  onMarkProgram: () => void;
}) {
  const [remaining, setRemaining] = useState(5);
  const acted = useRef(false);

  useEffect(() => {
    if (!visible || !channel) return;
    acted.current = false;
    setRemaining(5);
    const started = Date.now();
    const ticker = setInterval(() => {
      setRemaining(
        Math.max(0, Math.ceil((AUTO_WATCH_MS - (Date.now() - started)) / 1000)),
      );
    }, 200);
    const timer = setTimeout(() => {
      if (acted.current) return;
      acted.current = true;
      onWatch();
    }, AUTO_WATCH_MS);
    return () => {
      clearInterval(ticker);
      clearTimeout(timer);
    };
  }, [channel, onWatch, visible]);

  if (!channel) return null;

  const interact = (action: () => void) => {
    acted.current = true;
    setRemaining(0);
    action();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => interact(onClose)}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={() => interact(onClose)} />
        <View style={styles.card}>
          <View style={styles.preview}>
            <LinearGradient
              colors={["#2E5A88", C.bgDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={FILL}
            />
            {channel.logo ? (
              <Image
                source={{ uri: channel.logo }}
                style={styles.heroLogo}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.heroInitials}>
                <Text style={styles.heroInitialsText}>{initials(channel.name)}</Text>
              </View>
            )}
            <View style={styles.previewTop}>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <Pressable
                onPress={() => interact(onClose)}
                hitSlop={10}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close channel details"
              >
                <Ionicons name="close" size={17} color={C.white} />
              </Pressable>
            </View>
            <LinearGradient
              colors={["transparent", "rgba(7,8,10,0.92)"]}
              style={styles.previewShade}
            />
          </View>

          <View style={styles.body}>
            <Text style={styles.eyebrow}>WALLORA LIVE TV</Text>
            <Text style={styles.title} numberOfLines={2}>
              {channel.name}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta} numberOfLines={1}>
                {groupLabel(channel.group)}
              </Text>
              {typeof rank === "number" && (
                <Text style={styles.meta}>· #{rank + 1} in WALLORA</Text>
              )}
              {!!likes && <Text style={styles.meta}>· {likes} likes</Text>}
            </View>

            {remaining > 0 && (
              <View style={styles.autoRow}>
                <Ionicons name="timer-outline" size={14} color={C.accent} />
                <Text style={styles.autoText}>
                  Opening player in {remaining}s · tap any action to stay here
                </Text>
                <View style={styles.autoTrack}>
                  <View
                    style={[
                      styles.autoFill,
                      { width: `${(remaining / 5) * 100}%` },
                    ]}
                  />
                </View>
              </View>
            )}

            <Pressable
              onPress={() => interact(onWatch)}
              style={styles.primaryButton}
            >
              <Ionicons name="play" size={17} color={C.bg} />
              <Text style={styles.primaryText}>Watch channel</Text>
            </Pressable>

            <View style={styles.actionGrid}>
              <Pressable
                onPress={() => interact(onMarkProgram)}
                style={styles.actionButton}
              >
                <Ionicons name="sparkles-outline" size={17} color={C.accent} />
                <Text style={styles.actionText}>AI mark program</Text>
              </Pressable>
              <Pressable
                onPress={() => interact(onToggleFavorite)}
                style={styles.actionButton}
              >
                <Ionicons
                  name={isFavorite ? "heart" : "heart-outline"}
                  size={17}
                  color={isFavorite ? C.accent : C.textSoft}
                />
                <Text style={[styles.actionText, isFavorite && styles.actionTextActive]}>
                  {isFavorite ? "Favorited" : "Favorite"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => interact(onRecommend)}
                style={styles.actionButton}
              >
                <Ionicons name="people-outline" size={17} color={C.textSoft} />
                <Text style={styles.actionText}>Recommend</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: C.overlay,
  },
  backdropTouch: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  card: {
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    backgroundColor: C.bgElevated,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    ...SHADOW.hero,
  },
  preview: { height: 190, position: "relative" },
  heroLogo: {
    position: "absolute",
    width: 82,
    height: 82,
    left: 20,
    bottom: 20,
    zIndex: 2,
  },
  heroInitials: {
    position: "absolute",
    width: 82,
    height: 82,
    left: 20,
    bottom: 20,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  heroInitialsText: { color: C.white, fontSize: 27, fontWeight: "900" },
  previewTop: {
    position: "absolute",
    top: 12,
    left: 14,
    right: 14,
    zIndex: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: R.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FF4D4D" },
  liveText: { color: C.white, fontSize: 9, fontWeight: "900", letterSpacing: 0.9 },
  closeButton: {
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewShade: { ...FILL, zIndex: 1 },
  body: { padding: 18, paddingBottom: 24 },
  eyebrow: { color: C.accent, fontSize: 9, fontWeight: "900", letterSpacing: 1.3 },
  title: { color: C.text, fontSize: 23, fontWeight: "900", marginTop: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  meta: { color: C.muted, fontSize: 11 },
  autoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: R.md,
    backgroundColor: C.accentDim,
  },
  autoText: { color: C.accentBright, fontSize: 10.5, fontWeight: "700", flex: 1 },
  autoTrack: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 0,
    height: 2,
    backgroundColor: C.border,
    overflow: "hidden",
    borderRadius: 2,
  },
  autoFill: { height: 2, backgroundColor: C.accent },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    marginTop: 16,
    borderRadius: R.md,
    backgroundColor: C.accent,
  },
  primaryText: { color: C.bg, fontSize: 13, fontWeight: "900" },
  actionGrid: { flexDirection: "row", gap: 9, marginTop: 10 },
  actionButton: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 6,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  actionText: { color: C.textSoft, fontSize: 10, fontWeight: "800", textAlign: "center" },
  actionTextActive: { color: C.accent },
});
