import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { nextTimeAt } from "./tvBrowse";

export type TvReminderRepeat = "once" | "daily";
export type TvReminderSource = "manual" | "ai";

export type TvReminder = {
  id: string;
  channelId: string;
  channelName: string;
  programTitle: string;
  startsAt: number;
  createdAt: number;
  leadMinutes: number;
  repeat: TvReminderRepeat;
  source: TvReminderSource;
  notificationId?: string;
};

const REMINDERS_KEY = "wallora.tv.reminders.v1";
const CHANNEL_ID = "wallora-tv-reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function listTvReminders(): Promise<TvReminder[]> {
  try {
    const raw = await AsyncStorage.getItem(REMINDERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item): TvReminder => ({
        id: String(item.id ?? `${Date.now()}-${Math.random()}`),
        channelId: String(item.channelId ?? ""),
        channelName: String(item.channelName ?? "WALLORA TV"),
        programTitle: String(item.programTitle ?? "Channel reminder"),
        startsAt: Number(item.startsAt ?? Date.now()),
        createdAt: Number(item.createdAt ?? Date.now()),
        leadMinutes: Number.isFinite(item.leadMinutes)
          ? Number(item.leadMinutes)
          : 10,
        repeat: item.repeat === "daily" ? "daily" : "once",
        source: item.source === "ai" ? "ai" : "manual",
        notificationId:
          typeof item.notificationId === "string" ? item.notificationId : undefined,
      }))
      .sort((a, b) => nextStartAt(a) - nextStartAt(b));
  } catch {
    return [];
  }
}

async function persist(reminders: TvReminder[]): Promise<void> {
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders)).catch(() => {});
}

async function ensurePermission(): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: "WALLORA TV reminders",
        description: "Alerts for programs and channels you want to watch.",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 160, 200],
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return !!requested.granted;
  } catch {
    return false;
  }
}

/** Next time this reminder will fire, including daily repeats. */
export function nextStartAt(reminder: TvReminder): number {
  if (reminder.repeat !== "daily") return reminder.startsAt;
  const original = new Date(reminder.startsAt);
  return nextTimeAt(original.getHours(), original.getMinutes()).getTime();
}

/**
 * Schedule a local reminder. Local notifications work in Expo Go; only remote
 * push is unavailable there. Daily reminders use Expo's calendar-style DAILY
 * trigger, so they keep repeating after the app is closed.
 */
export async function addProgramReminder(input: {
  channelId: string;
  channelName: string;
  programTitle: string;
  startsAt: number;
  leadMinutes?: number;
  repeat?: TvReminderRepeat;
  source?: TvReminderSource;
}): Promise<TvReminder | null> {
  if (!(await ensurePermission())) return null;
  if (!Number.isFinite(input.startsAt)) return null;

  const leadMinutes = Math.max(0, Math.round(input.leadMinutes ?? 10));
  const repeat: TvReminderRepeat = input.repeat === "daily" ? "daily" : "once";
  const notifyAt = new Date(input.startsAt - leadMinutes * 60_000);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const deeplink = `/live-tv/player?channel=${encodeURIComponent(input.channelId)}`;

  try {
    const trigger =
      repeat === "daily"
        ? {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: notifyAt.getHours(),
            minute: notifyAt.getMinutes(),
            channelId: CHANNEL_ID,
          }
        : {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: notifyAt,
            channelId: CHANNEL_ID,
          };

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${input.programTitle || "Program"} on ${input.channelName}`,
        body:
          leadMinutes > 0
            ? `Starts in ${leadMinutes} minute${leadMinutes === 1 ? "" : "s"} · Open WALLORA TV`
            : "On air now · Open WALLORA TV",
        data: {
          url: deeplink,
          reminderId: id,
          channelId: input.channelId,
          programTitle: input.programTitle,
        },
      },
      trigger,
    });

    const reminder: TvReminder = {
      id,
      channelId: input.channelId,
      channelName: input.channelName,
      programTitle: input.programTitle || "Program reminder",
      startsAt: input.startsAt,
      createdAt: Date.now(),
      leadMinutes,
      repeat,
      source: input.source ?? "manual",
      notificationId,
    };
    const reminders = await listTvReminders();
    await persist([...reminders, reminder]);
    return reminder;
  } catch {
    return null;
  }
}

/** Backwards-compatible wrapper used by the original reminders screen. */
export async function addTvReminder(input: {
  channelId: string;
  channelName: string;
  startsAt: number;
}): Promise<TvReminder | null> {
  return addProgramReminder({
    channelId: input.channelId,
    channelName: input.channelName,
    programTitle: "Channel reminder",
    startsAt: input.startsAt,
    leadMinutes: 0,
    repeat: "once",
    source: "manual",
  });
}

export async function removeTvReminder(id: string): Promise<void> {
  const reminders = await listTvReminders();
  const target = reminders.find((item) => item.id === id);
  if (target?.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(target.notificationId).catch(
      () => {},
    );
  }
  await persist(reminders.filter((item) => item.id !== id));
}

export async function clearAllTvReminders(): Promise<void> {
  const reminders = await listTvReminders();
  await Promise.all(
    reminders
      .map((item) => item.notificationId)
      .filter((id): id is string => !!id)
      .map((id) =>
        Notifications.cancelScheduledNotificationAsync(id).catch(() => {}),
      ),
  );
  await persist([]);
}
