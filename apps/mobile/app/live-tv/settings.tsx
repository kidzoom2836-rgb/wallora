import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { C, R } from "../../lib/theme";
import {
  DEFAULT_PLAYLIST_URL,
  getCustomPlaylistUrl,
  setCustomPlaylistUrl,
} from "../../lib/iptv";
import {
  DEFAULT_TV_SETTINGS,
  getTvSettings,
  QUALITY_OPTIONS,
  saveTvSettings,
  type TvQuality,
  type TvSettings,
} from "../../lib/tvSettings";

function SettingRow({
  icon,
  title,
  detail,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button">
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={17} color={C.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail} numberOfLines={2}>
          {detail}
        </Text>
      </View>
      <Text style={styles.rowValue}>{value}</Text>
      <Ionicons name="chevron-forward" size={15} color={C.muted} />
    </Pressable>
  );
}

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

export default function LiveTvSettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<TvSettings>(DEFAULT_TV_SETTINGS);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [qualityOpen, setQualityOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getTvSettings(), getCustomPlaylistUrl()])
      .then(([storedSettings, customUrl]) => {
        if (!alive) return;
        setSettings(storedSettings);
        setPlaylistUrl(customUrl ?? "");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const update = async (patch: Partial<TvSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    await saveTvSettings(patch);
  };

  const savePlaylist = async (reset = false) => {
    setSaving(true);
    setNotice(null);
    try {
      await setCustomPlaylistUrl(reset ? null : playlistUrl);
      setNotice(
        reset
          ? "WALLORA community playlist restored."
          : "Playlist saved. Reopen the guide to load it.",
      );
      if (reset) setPlaylistUrl("");
    } catch {
      setNotice("Could not save that playlist URL.");
    } finally {
      setSaving(false);
    }
  };

  const quality = QUALITY_OPTIONS.find((option) => option.value === settings.quality)!;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="WALLORA TV settings" subtitle="Playback, data and guide sources" />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.section}>PLAYLIST SOURCE</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Custom M3U playlist</Text>
            <Text style={styles.cardDetail}>
              Leave empty to use channels saved in the WALLORA database. A custom
              playlist always overrides the database guide.
            </Text>
            <TextInput
              value={playlistUrl}
              onChangeText={setPlaylistUrl}
              placeholder={DEFAULT_PLAYLIST_URL}
              placeholderTextColor={C.mutedDark}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => void savePlaylist(false)}
                disabled={saving}
                style={styles.primaryButton}
              >
                <Ionicons name="checkmark" size={15} color={C.bg} />
                <Text style={styles.primaryButtonText}>Save playlist</Text>
              </Pressable>
              <Pressable
                onPress={() => void savePlaylist(true)}
                disabled={saving}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Reset</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.section}>VIDEO & DATA</Text>
          <View style={styles.card}>
            <SettingRow
              icon="resize-outline"
              title="Default resolution"
              detail={quality.detail}
              value={quality.label}
              onPress={() => setQualityOpen((open) => !open)}
            />
            {qualityOpen && (
              <View style={styles.optionList}>
                {QUALITY_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      void update({ quality: option.value as TvQuality });
                      setQualityOpen(false);
                    }}
                    style={[
                      styles.option,
                      settings.quality === option.value && styles.optionActive,
                    ]}
                  >
                    <Text style={styles.optionTitle}>{option.label}</Text>
                    <Text style={styles.optionDetail}>{option.detail}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <ToggleRow
              icon="speedometer-outline"
              title="Low-data mode (1 Mbps)"
              detail="Locks streams to the lowest available resolution and keeps reconnects conservative."
              value={settings.lowDataMode}
              onValueChange={(value) => void update({ lowDataMode: value })}
            />
            <ToggleRow
              icon="play-circle-outline"
              title="Autoplay"
              detail="Start the stream as soon as the full-screen player opens."
              value={settings.autoplay}
              onValueChange={(value) => void update({ autoplay: value })}
            />
          </View>

          <Text style={styles.section}>PLAYER OVERLAYS</Text>
          <View style={styles.card}>
            <ToggleRow
              icon="logo-closed-captioning"
              title="Subtitles on by default"
              detail="Turn on closed captions automatically when a channel provides them."
              value={settings.subtitlesDefault}
              onValueChange={(value) => void update({ subtitlesDefault: value })}
            />
            <ToggleRow
              icon="aperture-outline"
              title="WALLORA TV watermark"
              detail="Show the WALLORA TV mark over the video."
              value={settings.showWatermark}
              onValueChange={(value) => void update({ showWatermark: value })}
            />
          </View>

          {notice && (
            <View style={styles.notice}>
              <Ionicons name="information-circle-outline" size={15} color={C.accent} />
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          )}

          <Pressable
            onPress={() => router.push("/live-tv/reminders")}
            style={styles.linkButton}
          >
            <Ionicons name="alarm-outline" size={16} color={C.accent} />
            <Text style={styles.linkButtonText}>Manage channel reminders</Text>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 40 },
  section: {
    color: C.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginTop: 18,
    marginBottom: 8,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.borderSoft,
    padding: 14,
  },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: "800" },
  cardDetail: {
    color: C.muted,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 5,
  },
  input: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bgDeep,
    color: C.text,
    paddingHorizontal: 12,
    fontSize: 12,
  },
  buttonRow: { flexDirection: "row", gap: 9, marginTop: 11 },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 42,
    borderRadius: R.md,
    backgroundColor: C.accent,
  },
  primaryButtonText: { color: C.bg, fontSize: 12, fontWeight: "900" },
  secondaryButton: {
    minWidth: 88,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  secondaryButtonText: { color: C.textSoft, fontSize: 12, fontWeight: "700" },
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
  rowValue: { color: C.accent, fontSize: 11, fontWeight: "800" },
  switch: {
    width: 38,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.raisedHover,
    padding: 3,
  },
  switchOn: { backgroundColor: C.accent },
  switchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.white,
  },
  switchThumbOn: { marginLeft: 16 },
  optionList: { gap: 7, paddingVertical: 10 },
  option: {
    padding: 11,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.borderSoft,
  },
  optionActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  optionTitle: { color: C.text, fontSize: 12, fontWeight: "800" },
  optionDetail: { color: C.muted, fontSize: 10.5, marginTop: 2 },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
    padding: 11,
    borderRadius: R.md,
    backgroundColor: C.accentDim,
  },
  noticeText: { color: C.textSoft, fontSize: 11.5, flexShrink: 1 },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 16,
    padding: 14,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderSoft,
  },
  linkButtonText: { flex: 1, color: C.text, fontSize: 13, fontWeight: "800" },
});
