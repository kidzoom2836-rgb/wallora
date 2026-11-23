import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { C, R, SHADOW } from "../../lib/theme";
import { groupLabel, uniqueChannelId, type IptvChannel } from "../../lib/iptv";

const FILL = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

/** Dismissible home pop-up with a muted real-time preview of a live channel. */
export function LiveNowModal({
  channels,
  onClose,
  onWatch,
}: {
  channels: IptvChannel[];
  onClose: () => void;
  onWatch: (channelId: string) => void;
}) {
  const [selected, setSelected] = useState<IptvChannel | null>(
    channels[0] ?? null,
  );
  const player = useVideoPlayer(
    selected
      ? {
          uri: selected.url,
          metadata: { title: selected.name, artist: "WALLORA Live TV" },
        }
      : null,
    (instance) => {
      instance.muted = true;
      instance.loop = false;
    },
  );
  const { status } = useEvent(player, "statusChange", {
    status: player.status,
  });

  useEffect(() => {
    if (selected) player.play();
  }, [selected, player]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.preview}>
            {selected ? (
              <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                nativeControls={false}
              />
            ) : null}
            <View style={styles.previewShade} />
            <View style={styles.previewTop}>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE NOW</Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={17} color={C.white} />
              </Pressable>
            </View>
            <View style={styles.previewBottom}>
              <Text style={styles.previewEyebrow}>WALLORA LIVE TV</Text>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {selected?.name ?? "Community channels"}
              </Text>
              <Text style={styles.previewMeta} numberOfLines={1}>
                {channels.length.toLocaleString()} channels streaming right now
                {status === "loading" ? " · connecting…" : ""}
              </Text>
            </View>
          </View>

          <View style={styles.body}>
            <Text style={styles.bodyTitle}>TV is on in WALLORA</Text>
            <Text style={styles.bodyText}>
              Browse live channels, add your own M3U playlist and watch in
              fullscreen or Picture-in-Picture.
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {channels.slice(0, 8).map((channel, index) => {
                const active =
                  selected &&
                  uniqueChannelId(channel) === uniqueChannelId(selected);
                return (
                  <Pressable
                    key={`${uniqueChannelId(channel)}-${index}`}
                    onPress={() => setSelected(channel)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <View
                      style={[
                        styles.chipColor,
                        {
                          backgroundColor: active
                            ? C.accent
                            : ["#2E5A88", "#7A3F6B", "#3F6E5A", "#7A5A2E"][
                                index % 4
                              ],
                        },
                      ]}
                    />
                    <View>
                      <Text
                        style={[
                          styles.chipName,
                          active && styles.chipNameActive,
                        ]}
                        numberOfLines={1}
                      >
                        {channel.name}
                      </Text>
                      <Text style={styles.chipGroup} numberOfLines={1}>
                        {groupLabel(channel.group)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={() => onWatch(selected ? uniqueChannelId(selected) : "")}
              style={styles.primary}
            >
              <Ionicons name="play" size={16} color={C.bg} />
              <Text style={styles.primaryText}>Watch live TV</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.dismiss}>
              <Text style={styles.dismissText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    borderRadius: R.xl,
    overflow: "hidden",
    backgroundColor: C.bgElevated,
    borderWidth: 1,
    borderColor: C.border,
    ...SHADOW.hero,
  },
  preview: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: C.bgDeep,
    position: "relative",
  },
  previewShade: { ...FILL, backgroundColor: "rgba(0,0,0,0.35)" },
  previewTop: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    justifyContent: "space-between",
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
  liveText: {
    color: C.white,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewBottom: { position: "absolute", left: 13, right: 13, bottom: 11 },
  previewEyebrow: {
    color: C.accent,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  previewTitle: {
    color: C.white,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 3,
    textShadowColor: "#000",
    textShadowRadius: 4,
  },
  previewMeta: { color: C.textSoft, fontSize: 10.5, marginTop: 2 },
  body: { padding: 18 },
  bodyTitle: { color: C.text, fontSize: 19, fontWeight: "800" },
  bodyText: { color: C.textSoft, fontSize: 12, lineHeight: 18, marginTop: 6 },
  chips: { gap: 8, paddingVertical: 14 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 130,
    maxWidth: 170,
    padding: 9,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  chipColor: { width: 8, height: 30, borderRadius: 4 },
  chipName: { color: C.text, fontSize: 10.5, fontWeight: "800", maxWidth: 110 },
  chipNameActive: { color: C.accentBright },
  chipGroup: { color: C.muted, fontSize: 9, marginTop: 2, maxWidth: 110 },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: R.md,
    paddingVertical: 14,
  },
  primaryText: { color: C.bg, fontSize: 14, fontWeight: "800" },
  dismiss: { alignItems: "center", paddingVertical: 12 },
  dismissText: { color: C.muted, fontSize: 12 },
});
