import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

import { C, R } from "../../lib/theme";
import {
  ASPECT_RATIO_LABELS,
  type PlayerAspectRatio,
} from "../../lib/playerSettings";
import type { SourceVariant } from "../../lib/playerSources";

export type PlayerStats = {
  resolution: string;
  bufferedSec: number;
  liveDelaySec: number;
  status: string;
  sourceLabel: string;
  network: string;
};

function ToggleRow({
  icon,
  title,
  detail,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.toggleRow}>
      <View style={styles.toggleIcon}>
        <Ionicons name={icon} size={17} color={value ? C.accent : C.textSoft} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleDetail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <View style={[styles.switchTrack, value && styles.switchTrackOn]}>
        <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
      </View>
    </Pressable>
  );
}

function ActionRow({
  icon,
  title,
  detail,
  valueLabel,
  onPress,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  valueLabel?: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.toggleRow, disabled && styles.actionRowDisabled]}
      accessibilityState={{ disabled }}
    >
      <View style={styles.toggleIcon}>
        <Ionicons name={icon} size={17} color={disabled ? C.mutedDark : C.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.toggleTitle, disabled && styles.actionTitleDisabled]}>{title}</Text>
        <Text style={styles.toggleDetail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {valueLabel ? (
        <Text style={styles.actionValue}>{valueLabel}</Text>
      ) : (
        <Ionicons name="chevron-forward-outline" size={15} color={C.muted} />
      )}
    </Pressable>
  );
}

/** Power-user sheet that stays out of the way until the user asks for it. */
export function PlayerToolsDrawer({
  visible,
  onClose,
  stats,
  sources,
  activeSourceIndex,
  onSelectSource,
  onSuggestBackup,
  zappingEnabled,
  onToggleZapping,
  touchLocked,
  onToggleTouchLock,
  audioOnly,
  onToggleAudioOnly,
  nightMode,
  onToggleNightMode,
  backgroundAudio,
  onToggleBackgroundAudio,
  pipSupported,
  onStartPip,
  subtitleLabel,
  onCycleSubtitles,
  aspectRatio,
  onAspectRatioChange,
  qualityLabel,
  onCycleQuality,
  sleepMinutes,
  sleepRemainingSec,
  onSetSleepTimer,
  onCaptureClip,
}: {
  visible: boolean;
  onClose: () => void;
  stats: PlayerStats;
  sources: SourceVariant[];
  activeSourceIndex: number;
  onSelectSource: (index: number) => void;
  onSuggestBackup: (url: string) => Promise<void>;
  zappingEnabled: boolean;
  onToggleZapping: () => void;
  touchLocked: boolean;
  onToggleTouchLock: () => void;
  audioOnly: boolean;
  onToggleAudioOnly: () => void;
  nightMode: boolean;
  onToggleNightMode: () => void;
  backgroundAudio: boolean;
  onToggleBackgroundAudio: () => void;
  pipSupported: boolean;
  onStartPip: () => void;
  subtitleLabel: string;
  onCycleSubtitles: () => void;
  aspectRatio: PlayerAspectRatio;
  onAspectRatioChange: (ratio: PlayerAspectRatio) => void;
  qualityLabel: string;
  onCycleQuality: () => void;
  sleepMinutes: number | null;
  sleepRemainingSec: number | null;
  onSetSleepTimer: (minutes: number | null) => void;
  onCaptureClip: () => void;
}) {
  const [backupUrl, setBackupUrl] = useState("");
  const [backupError, setBackupError] = useState<string | null>(null);
  const [savingBackup, setSavingBackup] = useState(false);

  const submitBackup = async () => {
    if (savingBackup || !backupUrl.trim()) return;
    setSavingBackup(true);
    setBackupError(null);
    try {
      await onSuggestBackup(backupUrl.trim());
      setBackupUrl("");
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : "Could not save that URL.");
    } finally {
      setSavingBackup(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel="Close player tools" />
        <BlurView intensity={96} tint="dark" style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>WALLORA PLAYER</Text>
              <Text style={styles.title}>Tools &amp; diagnostics</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
              <Ionicons name="close" size={18} color={C.white} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Ionicons name="analytics-outline" size={14} color={C.accent} />
                <Text style={styles.sectionTitle}>Stream health</Text>
              </View>
              <View style={styles.statsGrid}>
                <View style={styles.statTile}>
                  <Text style={styles.statValue}>{stats.resolution}</Text>
                  <Text style={styles.statLabel}>RESOLUTION</Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={styles.statValue}>{stats.bufferedSec.toFixed(0)}s</Text>
                  <Text style={styles.statLabel}>BUFFERED</Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={styles.statValue}>
                    {stats.liveDelaySec > 0 ? `-${stats.liveDelaySec.toFixed(0)}s` : "LIVE"}
                  </Text>
                  <Text style={styles.statLabel}>LIVE DELAY</Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={styles.statValue}>{stats.network}</Text>
                  <Text style={styles.statLabel}>NETWORK</Text>
                </View>
              </View>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, stats.status === "Playing" && styles.statusDotLive]} />
                <Text style={styles.statusText} numberOfLines={1}>
                  {stats.status} · {stats.sourceLabel}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Ionicons name="server-outline" size={14} color={C.accent} />
                <Text style={styles.sectionTitle}>Server switcher</Text>
              </View>
              {sources.map((source, index) => {
                const active = index === activeSourceIndex;
                return (
                  <Pressable
                    key={source.id}
                    onPress={() => onSelectSource(index)}
                    style={[styles.sourceRow, active && styles.sourceRowActive]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.sourceLabel, active && styles.sourceLabelActive]}>
                        {source.label}
                      </Text>
                      <Text style={styles.sourceDetail} numberOfLines={1}>
                        {source.detail}
                      </Text>
                    </View>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={18} color={C.accent} />
                    ) : (
                      <Ionicons name="swap-horizontal-outline" size={16} color={C.muted} />
                    )}
                  </Pressable>
                );
              })}
              <View style={styles.backupInputRow}>
                <TextInput
                  value={backupUrl}
                  onChangeText={setBackupUrl}
                  placeholder="Paste a backup .m3u8 URL"
                  placeholderTextColor={C.mutedDark}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  style={styles.backupInput}
                />
                <Pressable
                  onPress={() => void submitBackup()}
                  disabled={savingBackup || !backupUrl.trim()}
                  style={[styles.backupAdd, (!backupUrl.trim() || savingBackup) && styles.backupAddDisabled]}
                >
                  <Ionicons name="add" size={16} color={C.bg} />
                </Pressable>
              </View>
              {backupError ? <Text style={styles.backupError}>{backupError}</Text> : null}
              <Text style={styles.helperText}>
                Backup links are stored only on this device and appear in the server list instantly.
              </Text>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Ionicons name="options-outline" size={14} color={C.accent} />
                <Text style={styles.sectionTitle}>Playback &amp; gestures</Text>
              </View>
              <ToggleRow
                icon="swap-vertical"
                title="Swipe to zap"
                detail="Flick up or down on the video to change channel"
                value={zappingEnabled}
                onPress={onToggleZapping}
              />
              <ToggleRow
                icon={touchLocked ? "lock-closed-outline" : "lock-open-outline"}
                title="Touch lock"
                detail="Ignore accidental taps and swipes"
                value={touchLocked}
                onPress={onToggleTouchLock}
              />
              <ToggleRow
                icon="videocam-off-outline"
                title="Audio only"
                detail="Hide video, keep commentary and screen-off playback"
                value={audioOnly}
                onPress={onToggleAudioOnly}
              />
              <ToggleRow
                icon="moon-outline"
                title="Night mode"
                detail="Dim the picture for low-light viewing"
                value={nightMode}
                onPress={onToggleNightMode}
              />
              <ToggleRow
                icon="musical-notes"
                title="Background audio"
                detail="Keep commentary playing when the app is backgrounded"
                value={backgroundAudio}
                onPress={onToggleBackgroundAudio}
              />
              <ActionRow
                icon="logo-closed-captioning"
                title="Subtitles"
                detail="Cycle closed captions when the stream provides them"
                valueLabel={subtitleLabel}
                onPress={onCycleSubtitles}
              />
              <ActionRow
                icon="contract-outline"
                title="Picture in picture"
                detail={pipSupported ? "Float this stream over other apps" : "Not supported on this device"}
                onPress={onStartPip}
                disabled={!pipSupported}
              />

              <Text style={styles.fieldLabel}>ASPECT RATIO</Text>
              <View style={styles.segmentRow}>
                {(Object.keys(ASPECT_RATIO_LABELS) as PlayerAspectRatio[]).map((ratio) => (
                  <Pressable
                    key={ratio}
                    onPress={() => onAspectRatioChange(ratio)}
                    style={[styles.segment, aspectRatio === ratio && styles.segmentActive]}
                  >
                    <Text style={[styles.segmentText, aspectRatio === ratio && styles.segmentTextActive]}>
                      {ASPECT_RATIO_LABELS[ratio]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.inlineRow}>
                <Text style={styles.fieldLabel}>VIDEO QUALITY</Text>
                <Pressable onPress={onCycleQuality} style={styles.qualityButton}>
                  <Ionicons name="resize-outline" size={12} color={C.accent} />
                  <Text style={styles.qualityButtonText}>{qualityLabel}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Ionicons name="timer-outline" size={14} color={C.accent} />
                <Text style={styles.sectionTitle}>Sleep timer</Text>
              </View>
              <View style={styles.segmentRow}>
                {[15, 30, 60].map((minutes) => (
                  <Pressable
                    key={minutes}
                    onPress={() => onSetSleepTimer(sleepMinutes === minutes ? null : minutes)}
                    style={[styles.segment, sleepMinutes === minutes && styles.segmentActive]}
                  >
                    <Text style={[styles.segmentText, sleepMinutes === minutes && styles.segmentTextActive]}>
                      {minutes}m
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => onSetSleepTimer(null)}
                  style={[styles.segment, sleepMinutes === null && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, sleepMinutes === null && styles.segmentTextActive]}>
                    Off
                  </Text>
                </Pressable>
              </View>
              {sleepRemainingSec !== null ? (
                <Text style={styles.helperText}>
                  Playback pauses in {Math.max(1, Math.ceil(sleepRemainingSec / 60))} minute(s).
                </Text>
              ) : null}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Ionicons name="information-circle-outline" size={14} color={C.accent} />
                <Text style={styles.sectionTitle}>Platform limits</Text>
              </View>
              <ActionRow
                icon="timer-outline"
                title="Audio delay"
                detail="Not exposed by expo-video — no fake slider shown"
                disabled
              />
              <ActionRow
                icon="expand-outline"
                title="Rotation lock"
                detail="Fullscreen follows the device rotation setting"
                disabled
              />
              <ActionRow
                icon="camera-outline"
                title="Frame snapshot"
                detail="Record a 9s clip below until native capture is added"
                disabled
              />
            </View>

            <Pressable onPress={onCaptureClip} style={styles.captureButton}>
              <Ionicons name="radio-outline" size={17} color={C.bg} />
              <Text style={styles.captureButtonText}>Capture 9s clip &amp; share</Text>
              <Ionicons name="share-social-outline" size={15} color={C.bg} />
            </Pressable>

            <Text style={styles.gestureLegend}>
              Left edge: brightness · Right edge: player volume · Double tap: ±10s · Hold: 2× boost
              {zappingEnabled ? " · Vertical swipe: zap channel" : ""}
            </Text>
          </ScrollView>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  dismiss: { ...StyleSheet.absoluteFill },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.28)",
    marginTop: 9,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
  },
  eyebrow: { color: C.accent, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: C.white, fontSize: 19, fontWeight: "900", marginTop: 2 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  content: { paddingHorizontal: 18, paddingBottom: 28 },
  section: {
    marginBottom: 18,
    padding: 13,
    borderRadius: R.lg,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 11 },
  sectionTitle: { color: C.white, fontSize: 12, fontWeight: "900" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statTile: {
    width: "47%",
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderRadius: R.md,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  statValue: { color: C.accentBright, fontSize: 16, fontWeight: "900" },
  statLabel: { color: C.muted, fontSize: 8.5, fontWeight: "800", letterSpacing: 0.8, marginTop: 3 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 11 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.muted },
  statusDotLive: { backgroundColor: C.success },
  statusText: { color: C.textSoft, fontSize: 10.5, flex: 1 },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    marginBottom: 7,
  },
  sourceRowActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  sourceLabel: { color: C.textSoft, fontSize: 11.5, fontWeight: "800" },
  sourceLabelActive: { color: C.accentBright },
  sourceDetail: { color: C.muted, fontSize: 9.5, marginTop: 2 },
  backupInputRow: { flexDirection: "row", gap: 7, marginTop: 9 },
  backupInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: R.md,
    paddingHorizontal: 12,
    color: C.white,
    fontSize: 11,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  backupAdd: {
    width: 40,
    minHeight: 40,
    borderRadius: R.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accent,
  },
  backupAddDisabled: { backgroundColor: C.mutedDark },
  backupError: { color: C.error, fontSize: 10, marginTop: 7 },
  helperText: { color: C.muted, fontSize: 9.5, lineHeight: 14, marginTop: 8 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  toggleIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  toggleTitle: { color: C.white, fontSize: 11.5, fontWeight: "800" },
  toggleDetail: { color: C.muted, fontSize: 9.5, marginTop: 2 },
  actionRowDisabled: { opacity: 0.62 },
  actionTitleDisabled: { color: C.textSoft },
  actionValue: { color: C.accentBright, fontSize: 9.5, fontWeight: "900" },
  switchTrack: {
    width: 36,
    height: 21,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.18)",
    padding: 2,
    justifyContent: "center",
  },
  switchTrackOn: { backgroundColor: C.accent },
  switchThumb: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: C.white,
    transform: [{ translateX: 0 }],
  },
  switchThumbOn: { transform: [{ translateX: 15 }], backgroundColor: C.bg },
  fieldLabel: { color: C.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 12 },
  segmentRow: { flexDirection: "row", gap: 7, marginTop: 8 },
  segment: {
    flex: 1,
    minHeight: 34,
    borderRadius: R.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  segmentActive: { backgroundColor: C.accentDim, borderColor: C.accent },
  segmentText: { color: C.textSoft, fontSize: 10.5, fontWeight: "800" },
  segmentTextActive: { color: C.accentBright },
  inlineRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  qualityButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: R.pill,
    backgroundColor: C.accentDim,
    marginTop: 12,
  },
  qualityButtonText: { color: C.accentBright, fontSize: 10, fontWeight: "900" },
  captureButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    minHeight: 46,
    borderRadius: R.pill,
    backgroundColor: C.accent,
    marginBottom: 12,
  },
  captureButtonText: { color: C.bg, fontSize: 12, fontWeight: "900" },
  gestureLegend: {
    color: C.muted,
    fontSize: 9.5,
    lineHeight: 15,
    textAlign: "center",
  },
});
