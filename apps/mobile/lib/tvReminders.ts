import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

export type TvReminder = {
  id: string;
  channelId: string;
  channelName: string;
  startsAt: number;
  createdAt: number;
  notificationId?: string;
};

const REMINDERS_KEY = "wallora.tv.reminders.v1";

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
      .filter((item): item is TvReminder => !!item && typeof item.id === "string")
      .sort((a, b) => a.startsAt - b.startsAt);
  } catch {
    return [];
  }
}

async function persist(reminders: TvReminder[]): Promise<void> {
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders)).catch(() => {});
}

async function ensurePermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return !!requested.granted;
  } catch {
    return false;
  }
}

/** Schedule a local reminder. This works in Expo Go; remote push does not. */
export async function addTvReminder(input: {
  channelId: string;
  channelName: string;
  startsAt: number;
}): Promise<TvReminder | null> {
  if (!(await ensurePermission())) return null;
  if (input.startsAt <= Date.now()) return null;

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const deeplink = `/live-tv/player?channel=${encodeURIComponent(input.channelId)}`;

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${input.channelName} starts soon`,
        body: "Open WALLORA TV to watch from the app.",
        data: { url: deeplink },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(input.startsAt),
      },
    });

    const reminder: TvReminder = {
      id,
      channelId: input.channelId,
      channelName: input.channelName,
      startsAt: input.startsAt,
      createdAt: Date.now(),
      notificationId,
    };
    const reminders = await listTvReminders();
    await persist([...reminders, reminder]);
    return reminder;
  } catch {
    return null;
  }
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
