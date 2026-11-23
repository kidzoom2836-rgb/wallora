import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useVideoPlayer, VideoView, type ContentType } from "expo-video";
import { Ionicons } from "@expo/vector-icons";

import { C, R } from "../../lib/theme";

const FILL = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

/** A muted nine-second looping preview that plays the captured clip in-app on tap. */
export function ChannelClipCard({
  uri,
  title,
  subtitle,
  onPress,
}: {
  uri: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLive = /\.m3u8(?:[?#]|$)/i.test(uri);
  const contentType: ContentType = isLive ? "hls" : "auto";

  const preview = useVideoPlayer(
    { uri, contentType, metadata: { title, artist: "WALLORA TV" } },
    (instance) => {
      instance.muted = true;
      instance.loop = true;
      instance.play();
    },
  );

  const fullPlayer = useVideoPlayer(
    expanded
      ? { uri, contentType, metadata: { title, artist: "WALLORA TV" } }
      : null,
    (instance) => {
      instance.muted = false;
      instance.loop = false;
      instance.play();
    },
  );

  useEffect(() => {
    const timer = setTimeout(() => preview.pause(), 9000);
    return () => clearTimeout(timer);
  }, [preview]);

  useEffect(() => {
    if (expanded) fullPlayer.play();
    else fullPlayer.pause();
  }, [expanded, fullPlayer]);

  return (
    <>
      <Pressable
        onPress={() => {
          setExpanded(true);
          onPress?.();
        }}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`Play 9 second clip: ${title}`}
      >
        <VideoView
          player={preview}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          surfaceType="textureView"
          nativeControls={false}
        />
        <View style={styles.shade} />
        <View style={styles.badge}>
          <View style={styles.dot} />
          <Text style={styles.badgeText}>
            {isLive ? "LIVE PREVIEW" : "9s PREVIEW"}
          </Text>
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

      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalDismiss}
            onPress={() => setExpanded(false)}
          />
          <View style={styles.playerCard}>
            <View style={styles.playerHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.playerEyebrow}>WALLORA TV · 9s CAPTURE</Text>
                <Text style={styles.playerTitle} numberOfLines={1}>
                  {title}
                </Text>
              </View>
              <Pressable
                onPress={() => setExpanded(false)}
                hitSlop={10}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close clip player"
              >
                <Ionicons name="close" size={18} color={C.white} />
              </Pressable>
            </View>
            <View style={styles.playerSurface}>
              <VideoView
                player={fullPlayer}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                nativeControls
              />
            </View>
            <Text style={styles.playerFooter}>
              Playing the captured clip inside WALLORA · tap close to return
            </Text>
          </View>
        </View>
      </Modal>
    </>
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
  shade: { ...FILL, backgroundColor: "rgba(0,0,0,0.28)" },
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
  badgeText: {
    color: C.white,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  bottom: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    color: C.white,
    fontSize: 15,
    fontWeight: "800",
    textShadowColor: "#000",
    textShadowRadius: 4,
  },
  subtitle: { color: C.textSoft, fontSize: 11, marginTop: 2 },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalDismiss: { ...FILL },
  playerCard: {
    width: "100%",
    maxWidth: 620,
    borderRadius: R.xl,
    overflow: "hidden",
    backgroundColor: C.bgElevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  playerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
  },
  playerEyebrow: {
    color: C.accent,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  playerTitle: { color: C.text, fontSize: 15, fontWeight: "800", marginTop: 3 },
  closeButton: {
    width: 33,
    height: 33,
    borderRadius: 17,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  playerSurface: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: C.bgDeep,
  },
  playerFooter: {
    color: C.muted,
    fontSize: 10.5,
    textAlign: "center",
    padding: 12,
  },
});
