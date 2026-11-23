import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { C, R } from "../../lib/theme";
import { uniqueChannelId, type IptvChannel } from "../../lib/iptv";
import {
  formatClock,
  nextTimeAt,
  parseClock,
  suggestProgramTitle,
} from "../../lib/tvBrowse";
import { addProgramReminder } from "../../lib/tvReminders";

const LEAD_OPTIONS = [0, 5, 10, 30];

/** On-device AI-style program marker: suggested title/time, fully editable. */
export function ProgramReminderModal({
  channel,
  visible,
  onClose,
  onSaved,
}: {
  channel: IptvChannel | null;
  visible: boolean;
  onClose: () => void;
  onSaved?: (message: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("20:00");
  const [leadMinutes, setLeadMinutes] = useState(10);
  const [daily, setDaily] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !channel) return;
    const now = new Date();
    setTitle(suggestProgramTitle(channel, now));
    setTime(formatClock(nextTimeAt(now.getHours(), now.getMinutes(), now)));
    setLeadMinutes(10);
    setDaily(true);
  }, [channel, visible]);

  const save = async () => {
    if (!channel) return;
    const parsed = parseClock(time);
    if (!parsed) {
      onSaved?.("Use a time like 20:30.");
      return;
    }
    setSaving(true);
    try {
      const startsAt = nextTimeAt(parsed.hour, parsed.minute).getTime();
      const reminder = await addProgramReminder({
        channelId: uniqueChannelId(channel),
        channelName: channel.name,
        programTitle: title.trim() || suggestProgramTitle(channel),
        startsAt,
        leadMinutes,
        repeat: daily ? "daily" : "once",
        source: "ai",
      });
      onSaved?.(
        reminder
          ? daily
            ? `${title.trim() || "Program"} will remind you daily at ${time}.`
            : `Reminder set for ${time}.`
          : "Allow notifications to use program reminders.",
      );
      if (reminder) onClose();
    } catch {
      onSaved?.("Could not save that reminder. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!channel) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.handle} />
          <View style={styles.headingRow}>
            <View style={styles.aiIcon}>
              <Ionicons name="sparkles" size={17} color={C.bg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>AI PROGRAM MARKER</Text>
              <Text style={styles.title}>Never miss this show</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={19} color={C.muted} />
            </Pressable>
          </View>

          <View style={styles.channelRow}>
            <View style={styles.channelDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.channelName} numberOfLines={1}>
                {channel.name}
              </Text>
              <Text style={styles.channelMeta} numberOfLines={1}>
                Program detected from channel category and time of day
              </Text>
            </View>
          </View>

          <Text style={styles.label}>PROGRAM NAME</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Daily soap opera"
            placeholderTextColor={C.mutedDark}
            style={styles.input}
          />

          <View style={styles.twoColumns}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>START TIME</Text>
              <TextInput
                value={time}
                onChangeText={setTime}
                placeholder="20:30"
                placeholderTextColor={C.mutedDark}
                keyboardType="numbers-and-punctuation"
                style={styles.input}
              />
            </View>
            <Pressable
              onPress={() => setDaily((value) => !value)}
              style={[styles.dailyButton, daily && styles.dailyButtonActive]}
            >
              <Ionicons
                name={daily ? "repeat" : "calendar-outline"}
                size={15}
                color={daily ? C.bg : C.accent}
              />
              <Text style={[styles.dailyText, daily && styles.dailyTextActive]}>
                {daily ? "Every day" : "Once"}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>REMIND ME BEFORE</Text>
          <View style={styles.leadRow}>
            {LEAD_OPTIONS.map((minutes) => (
              <Pressable
                key={minutes}
                onPress={() => setLeadMinutes(minutes)}
                style={[
                  styles.leadChip,
                  leadMinutes === minutes && styles.leadChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.leadText,
                    leadMinutes === minutes && styles.leadTextActive,
                  ]}
                >
                  {minutes === 0 ? "At start" : `${minutes}m`}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => void save()}
            disabled={saving}
            style={[styles.saveButton, saving && styles.disabled]}
          >
            <Ionicons name="alarm-outline" size={16} color={C.bg} />
            <Text style={styles.saveText}>
              {saving ? "Saving…" : "Create reminder"}
            </Text>
          </Pressable>
          <Text style={styles.footer}>
            Local notification · works in Expo Go · appears on your home screen.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  card: {
    padding: 18,
    paddingBottom: 26,
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    backgroundColor: C.bgElevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.raisedHover,
    alignSelf: "center",
    marginBottom: 16,
  },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  aiIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { color: C.accent, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: C.text, fontSize: 19, fontWeight: "900", marginTop: 2 },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    padding: 11,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderSoft,
  },
  channelDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.accent },
  channelName: { color: C.text, fontSize: 12.5, fontWeight: "800" },
  channelMeta: { color: C.muted, fontSize: 10, marginTop: 2 },
  label: {
    color: C.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 7,
  },
  input: {
    minHeight: 44,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    paddingHorizontal: 12,
    color: C.text,
    fontSize: 13,
  },
  twoColumns: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  dailyButton: {
    minHeight: 44,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  dailyButtonActive: { backgroundColor: C.accent, borderColor: C.accent },
  dailyText: { color: C.textSoft, fontSize: 11, fontWeight: "800" },
  dailyTextActive: { color: C.bg },
  leadRow: { flexDirection: "row", gap: 8 },
  leadChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderSoft,
  },
  leadChipActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  leadText: { color: C.textSoft, fontSize: 11, fontWeight: "800" },
  leadTextActive: { color: C.accent },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    marginTop: 20,
    borderRadius: R.md,
    backgroundColor: C.accent,
  },
  saveText: { color: C.bg, fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.6 },
  footer: {
    color: C.mutedDark,
    fontSize: 10,
    textAlign: "center",
    marginTop: 10,
  },
});
