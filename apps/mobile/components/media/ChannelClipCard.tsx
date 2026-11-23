import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { C, R } from "../../lib/theme";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

/** A muted nine-second looping preview used for channel recommendations in the feed. */
export function ChannelClipCard({
  uri,
  title,
  subtitle,
  onPress,
}: {
  uri: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  const player = useVideoPlayer(
    { uri, metadata: { title, artist: "WALLORA TV" } },
    (instance) => {
      instance.muted = true;
      instance.loop = true;
      instance.play();
    },
  );

  useEffect(() => {
    const timer = setTimeout(() => player.pause(), 9000);
    return () => clearTimeout(timer);
  }, [player]);

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        surfaceType="textureView"
        nativeControls={false}
      />
      <View style={styles.shade} />
      <View style={styles.badge}>
        <View style={styles.dot} />
        <Text style={styles.badgeText}>9s PREVIEW</Text>
      </View>
      <View style={styles.bottom}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.play}>
          <Ionicons name="play" size={18} color={C.bg} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 190,
    borderRadius: R.lg,
    overflow: "hidden",
    backgroundColor: C.bgDeep,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  shade: {
    ...FILL,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: R.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FF4D4D" },
  badgeText: { color: C.white, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  bottom: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: { color: C.white, fontSize: 15, fontWeight: "800", textShadowColor: "#000", textShadowRadius: 4 },
  subtitle: { color: C.textSoft, fontSize: 11, marginTop: 2 },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
