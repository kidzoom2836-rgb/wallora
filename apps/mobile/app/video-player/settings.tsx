import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { C, R } from "../../lib/theme";
import {
  DEFAULT_VIDEO_SETTINGS,
  getVideoSettings,
  saveVideoSettings,
  VIDEO_SLEEP_OPTIONS,
  VIDEO_SPEEDS,
  type VideoSettings,
} from "../../lib/videoSettings";

const QUALITIES: { value: VideoSettings["quality"]; label: string; detail: string }[] = [
  { value: "auto", label: "Auto", detail: "Best rendition available" },
  { value: "480p", label: "480p", detail: "Data saver — stable on slow networks" },
  { value: "720p", label: "720p", detail: "Balanced quality" },
  { value: "1080p", label: "1080p", detail: "Highest quality" },
];

function ToggleRow({
  icon,
  title,
  detail,
  value,
  onValueChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={styles.row}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={17} color={C.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail} numberOfLines={2}>
          {detail}
        </Text>
      </View>
      <View style={[styles.switch, value && styles.switchOn]}>
        <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
      </View>
    </Pressable>
  );
}

function ChoiceGroup<T extends string | number | null>({
  options,
  value,
  onSelect,
  labelFor,
  detailFor,
}: {
  options: T[];
  value: T;
  onSelect: (value: T) => void;
  labelFor: (value: T) => string;
  detailFor?: (value: T) => string;
}) {
  return (
    <View style={styles.optionRow}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={String(option)}
            onPress={() => onSelect(option)}
            style={[styles.option, active && styles.optionActive]}
          >
            <Text style={[styles.optionText, active && styles.optionTextActive]}>
              {labelFor(option)}
            </Text>
            {detailFor && (
              <Text style={styles.optionDetail} numberOfLines={2}>
                {detailFor(option)}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function VideoSettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<VideoSettings>(DEFAULT_VIDEO_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getVideoSettings()
      .then((stored) => {
        if (alive) setSettings(stored);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const update = (patch: Partial<VideoSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    void saveVideoSettings(patch);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Player settings"
        subtitle="Defaults for every video you open"
        right={
          <Pressable onPress={() => router.back()} style={styles.closeButton} hitSlop={10}>
            <Ionicons name="close" size={19} color={C.text} />
          </Pressable>
        }
      />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.section}>PLAYBACK</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Default speed</Text>
            <ChoiceGroup
              options={VIDEO_SPEEDS}
              value={settings.speed}
              onSelect={(speed) => update({ speed })}
              labelFor={(speed) => `${speed}×`}
            />
            <Text style={styles.cardTitleSpaced}>Default quality</Text>
            <ChoiceGroup
              options={QUALITIES.map((option) => option.value)}
              value={settings.quality}
              onSelect={(quality) => update({ quality })}
              labelFor={(quality) => QUALITIES.find((option) => option.value === quality)?.label ?? quality}
              detailFor={(quality) =>
                QUALITIES.find((option) => option.value === quality)?.detail ?? ""
              }
            />
          </View>

          <Text style={styles.section}>PLAYER OVERLAYS</Text>
          <View style={styles.card}>
            <ToggleRow
              icon="logo-closed-captioning"
              title="Closed captions on"
              detail="Turn on captions automatically when the video provides them."
              value={settings.subtitlesEnabled}
              onValueChange={(subtitlesEnabled) => update({ subtitlesEnabled })}
            />
            <ToggleRow
              icon="aperture-outline"
              title="WALLORA watermark"
              detail="Show the WALLORA TV mark over the video."
              value={settings.showWatermark}
              onValueChange={(showWatermark) => update({ showWatermark })}
            />
            <ToggleRow
              icon="repeat-outline"
              title="Loop playback"
              detail="Restart the video automatically when it ends."
              value={settings.loop}
              onValueChange={(loop) => update({ loop })}
            />
            <ToggleRow
              icon="play-circle-outline"
              title="Autoplay"
              detail="Start playback as soon as the full-screen player opens."
              value={settings.autoplay}
              onValueChange={(autoplay) => update({ autoplay })}
            />
          </View>

          <Text style={styles.section}>SLEEP TIMER</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Stop after</Text>
            <ChoiceGroup
              options={[null, ...VIDEO_SLEEP_OPTIONS] as (number | null)[]}
              value={settings.sleepMinutes}
              onSelect={(sleepMinutes) => update({ sleepMinutes })}
              labelFor={(minutes) => (minutes === null ? "Off" : `${minutes} min`)}
            />
            <Text style={styles.helper}>
              The sleep timer can also be started from the player settings button.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 40 },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: R.md,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    color: C.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginTop: 18,
    marginBottom: 8,
  },
  card: {
    padding: 14,
    borderRadius: R.xl,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderSoft,
  },
  cardTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  cardTitleSpaced: { color: C.text, fontSize: 13, fontWeight: "800", marginTop: 18 },
  helper: { color: C.muted, fontSize: 10.5, lineHeight: 15, marginTop: 10 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  option: {
    minWidth: 64,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bgDeep,
  },
  optionActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  optionText: { color: C.textSoft, fontSize: 11, fontWeight: "800", textAlign: "center" },
  optionTextActive: { color: C.accent },
  optionDetail: { color: C.muted, fontSize: 9, marginTop: 3, textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSoft,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentDim,
  },
  rowTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  rowDetail: { color: C.muted, fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  switch: {
    width: 38,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.raisedHover,
    padding: 3,
  },
  switchOn: { backgroundColor: C.accent },
  switchThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.white },
  switchThumbOn: { marginLeft: 16 },
});
