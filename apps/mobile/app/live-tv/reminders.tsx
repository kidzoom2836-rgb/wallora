import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { EmptyState } from "../../components/ui/States";
import { C, R } from "../../lib/theme";
import { groupLabel, loadPlaylist, uniqueChannelId, type IptvChannel } from "../../lib/iptv";
import {
  addTvReminder,
  listTvReminders,
  removeTvReminder,
  type TvReminder,
} from "../../lib/tvReminders";

const LEAD_OPTIONS = [5, 10, 30];

export default function LiveTvRemindersScreen() {
  const [channels, setChannels] = useState<IptvChannel[]>([]);
  const [reminders, setReminders] = useState<TvReminder[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [leadMinutes, setLeadMinutes] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [playlist, saved] = await Promise.all([
      loadPlaylist(),
      listTvReminders(),
    ]);
    setChannels(playlist.channels.slice(0, 80));
    setReminders(saved);
    setSelectedId((current) => current || uniqueChannelId(playlist.channels[0]));
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const selected = useMemo(
    () => channels.find((channel) => uniqueChannelId(channel) === selectedId) ?? null,
    [channels, selectedId],
  );

  const schedule = async () => {
    if (!selected) {
      setNotice("Choose a channel first.");
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const created = await addTvReminder({
        channelId: uniqueChannelId(selected),
        channelName: selected.name,
        startsAt: Date.now() + leadMinutes * 60_000,
      });
      setNotice(
        created
          ? `Reminder set for ${selected.name} in ${leadMinutes} minutes.`
          : "Allow notifications to use channel reminders.",
      );
      setReminders(await listTvReminders());
    } catch {
      setNotice("Could not schedule that reminder.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await removeTvReminder(id);
    setReminders(await listTvReminders());
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Channel reminders"
        subtitle="Local alerts that work inside Expo Go"
      />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.section}>1 · CHOOSE A CHANNEL</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.channels}
          >
            {channels.map((channel) => {
              const id = uniqueChannelId(channel);
              const active = id === selectedId;
              return (
                <Pressable
                  key={id}
                  onPress={() => setSelectedId(id)}
                  style={[styles.channelChip, active && styles.channelChipActive]}
                >
                  <Text
                    style={[styles.channelChipText, active && styles.channelChipTextActive]}
                    numberOfLines={1}
                  >
                    {channel.name}
                  </Text>
                  <Text style={styles.channelChipGroup} numberOfLines={1}>
                    {groupLabel(channel.group)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.section}>2 · REMIND ME BEFORE</Text>
          <View style={styles.leadRow}>
            {LEAD_OPTIONS.map((minutes) => (
              <Pressable
                key={minutes}
                onPress={() => setLeadMinutes(minutes)}
                style={[styles.leadChip, leadMinutes === minutes && styles.leadChipActive]}
              >
                <Text
                  style={[
                    styles.leadChipText,
                    leadMinutes === minutes && styles.leadChipTextActive,
                  ]}
                >
                  {minutes} min
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => void schedule()}
            disabled={saving || !selected}
            style={[styles.primaryButton, (!selected || saving) && styles.disabled]}
          >
            <Ionicons name="alarm-outline" size={16} color={C.bg} />
            <Text style={styles.primaryButtonText}>
              {saving ? "Scheduling…" : "Set channel reminder"}
            </Text>
          </Pressable>

          {notice && (
            <View style={styles.notice}>
              <Ionicons name="information-circle-outline" size={15} color={C.accent} />
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          )}

          <Text style={styles.section}>YOUR REMINDERS</Text>
          {reminders.length === 0 ? (
            <EmptyState
              icon="alarm-outline"
              title="No reminders yet"
              message="Pick a channel and a time to get a local WALLORA alert."
            />
          ) : (
            <View style={styles.reminderList}>
              {reminders.map((reminder) => (
                <View key={reminder.id} style={styles.reminderCard}>
                  <View style={styles.reminderIcon}>
                    <Ionicons name="tv-outline" size={17} color={C.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reminderTitle} numberOfLines={1}>
                      {reminder.channelName}
                    </Text>
                    <Text style={styles.reminderTime}>
                      {new Date(reminder.startsAt).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => void remove(reminder.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Remove reminder"
                  >
                    <Ionicons name="trash-outline" size={17} color={C.error} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
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
    letterSpacing: 1.3,
    marginTop: 16,
    marginBottom: 9,
  },
  channels: { gap: 8, paddingRight: 16 },
  channelChip: {
    minWidth: 126,
    maxWidth: 170,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderSoft,
  },
  channelChipActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  channelChipText: { color: C.text, fontSize: 12, fontWeight: "800" },
  channelChipTextActive: { color: C.accent },
  channelChipGroup: { color: C.muted, fontSize: 10, marginTop: 2 },
  leadRow: { flexDirection: "row", gap: 9 },
  leadChip: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderSoft,
  },
  leadChipActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  leadChipText: { color: C.textSoft, fontSize: 12, fontWeight: "800" },
  leadChipTextActive: { color: C.accent },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    minHeight: 46,
    borderRadius: R.md,
    backgroundColor: C.accent,
  },
  primaryButtonText: { color: C.bg, fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.5 },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 12,
    padding: 11,
    borderRadius: R.md,
    backgroundColor: C.accentDim,
  },
  noticeText: { color: C.textSoft, fontSize: 11.5, flexShrink: 1 },
  reminderList: { gap: 9 },
  reminderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 12,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderSoft,
  },
  reminderIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentDim,
  },
  reminderTitle: { color: C.text, fontSize: 12.5, fontWeight: "800" },
  reminderTime: { color: C.muted, fontSize: 10.5, marginTop: 3 },
});
