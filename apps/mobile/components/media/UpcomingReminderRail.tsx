import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useVideoPlayer, VideoView, type ContentType } from "expo-video";
import { Ionicons } from "@expo/vector-icons";

import { SectionTitle } from "../ui/States";
import { C, R, SHADOW } from "../../lib/theme";
import { groupLabel, uniqueChannelId, type IptvChannel } from "../../lib/iptv";
import { nextStartAt, type TvReminder } from "../../lib/tvReminders";

function countdown(target: number): string {
  const minutes = Math.max(0, Math.round((target - Date.now()) / 60_000));
  if (minutes < 1) return "Starting now";
  if (minutes < 60) return `In ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `In ${hours}h ${rest}m` : `In ${hours}h`;
}

function ReminderPreviewCard({
  reminder,
  channel,
  onWatch,
}: {
  reminder: TvReminder;
  channel: IptvChannel;
  onWatch: (channelId: string) => void;
}) {
  const [now, setNow] = useState(Date.now());
  const isLive = /\.m3u8(?:[?#]|$)/i.test(channel.url);
  const contentType: ContentType = isLive ? "hls" : "auto";
  const player = useVideoPlayer(
    {
      uri: channel.url,
      contentType,
      metadata: { title: reminder.programTitle, artist: "WALLORA TV" },
    },
    (instance) => {
      instance.muted = true;
      instance.loop = true;
      instance.play();
    },
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const starts = nextStartAt(reminder);
  const notifyAt = starts - reminder.leadMinutes * 60_000;

  return (
    <Pressable
      onPress={() => onWatch(uniqueChannelId(channel))}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Watch ${reminder.programTitle} on ${channel.name}`}
    >
      <View style={styles.preview}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          surfaceType="textureView"
          nativeControls={false}
        />
        <View style={styles.previewShade} />
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE PREVIEW</Text>
        </View>
        <View style={styles.timePill}>
          <Ionicons name="alarm-outline" size={11} color={C.bg} />
          <Text style={styles.timeText}>{notifyAt > now ? countdown(notifyAt) : "NOW"}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.program} numberOfLines={1}>
          {reminder.programTitle}
        </Text>
        <Text style={styles.channel} numberOfLines={1}>
          {channel.name} · {groupLabel(channel.group)}
        </Text>
        <Text style={styles.repeat}>
          {reminder.repeat === "daily" ? "Every day" : "One time"} ·{" "}
          {new Date(starts).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    </Pressable>
  );
}

/** Home-screen rail showing live previews for programs the user marked. */
export function UpcomingReminderRail({
  reminders,
  channels,
  onWatch,
  onSeeAll,
}: {
  reminders: TvReminder[];
  channels: IptvChannel[];
  onWatch: (channelId: string) => void;
  onSeeAll: () => void;
}) {
  const items = reminders
    .map((reminder) => ({
      reminder,
      channel: channels.find(
        (channel) => uniqueChannelId(channel) === reminder.channelId,
      ),
    }))
    .filter(
      (item): item is { reminder: TvReminder; channel: IptvChannel } =>
        !!item.channel,
    )
    .sort((a, b) => nextStartAt(a.reminder) - nextStartAt(b.reminder))
    .slice(0, 4);

  if (!items.length) return null;

  return (
    <View style={styles.section}>
      <SectionTitle
        title="Coming up for you"
        subtitle="Programs you marked · live preview on air"
        actionLabel="All reminders"
        onAction={onSeeAll}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {items.map(({ reminder, channel }) => (
          <ReminderPreviewCard
            key={reminder.id}
            reminder={reminder}
            channel={channel}
            onWatch={onWatch}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 26 },
  rail: { paddingLeft: 16, paddingRight: 40, gap: 12 },
  card: {
    width: 208,
    borderRadius: R.lg,
    overflow: "hidden",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    ...SHADOW.card,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  preview: { width: "100%", aspectRatio: 16 / 9, backgroundColor: C.bgDeep },
  previewShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  livePill: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: R.pill,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FF4D4D" },
  liveText: { color: C.white, fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  timePill: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.accent,
    borderRadius: R.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timeText: { color: C.bg, fontSize: 9, fontWeight: "900" },
  body: { padding: 11 },
  program: { color: C.text, fontSize: 12.5, fontWeight: "900" },
  channel: { color: C.textSoft, fontSize: 10.5, marginTop: 3 },
  repeat: { color: C.accent, fontSize: 9.5, marginTop: 5, fontWeight: "800" },
});
