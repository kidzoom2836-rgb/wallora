import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiJson, isAuthenticated } from "./api";

const ENABLED_KEY = "wallora.push.enabled";
const TOKEN_KEY = "wallora.push.token";

const EXPO_GO_ANDROID_MESSAGE =
  "Remote push notifications are unavailable in Expo Go on Android. Use a development build or the installed app; local notifications still work here.";

/**
 * Expo Go on Android removed remote push notification support in SDK 53, and
 * `expo-notifications` throws synchronously when push-token APIs are used
 * there. Local notifications remain available, so only the token paths are
 * disabled.
 */
export function isRemotePushAvailable(): boolean {
  return Platform.OS !== "web" && !(Platform.OS === "android" && isRunningInExpoGo());
}

export function getRemotePushUnavailableMessage(): string | null {
  if (isRemotePushAvailable()) return null;
  if (Platform.OS === "android" && isRunningInExpoGo()) return EXPO_GO_ANDROID_MESSAGE;
  return "Push notifications are not available in this environment.";
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function getPushPreference(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ENABLED_KEY)) === "true";
  } catch {
    return false;
  }
}

async function setPushPreference(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, enabled ? "true" : "false").catch(() => {});
}

/** Ask Android for a channel before requesting the push token. */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "WALLORA",
    description: "New wallpapers, features and account updates",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#D7B879",
  });
}

/**
 * Request OS permission, obtain an Expo push token and register it with the
 * WALLORA web API. Safe to call repeatedly: the backend upserts by token.
 */
export async function enablePushNotifications(): Promise<boolean> {
  if (!isRemotePushAvailable()) return false;
  try {
    await ensureChannel();
    const current = await Notifications.getPermissionsAsync();
    let permission = current;
    if (current.status !== "granted") {
      permission = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: false, allowSound: true },
      });
    }
    const granted =
      permission.granted ||
      permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    if (!granted) {
      await setPushPreference(false);
      return false;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
    if (!projectId) return false;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (!token) return false;

    await apiJson("/api/v1/push/tokens", {
      method: "POST",
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
    await setPushPreference(true);
    return true;
  } catch {
    // Push is an enhancement — never block auth or app usage when it fails.
    return false;
  }
}

export async function disablePushNotifications(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (token && isAuthenticated()) {
    await apiJson("/api/v1/push/tokens", {
      method: "DELETE",
      body: JSON.stringify({ token }),
    }).catch(() => {});
  }
  await AsyncStorage.multiRemove([TOKEN_KEY, ENABLED_KEY]).catch(() => {});
}

/** Re-register the device after a token roll or a new sign-in. */
export async function syncPushRegistration(): Promise<void> {
  if (!isRemotePushAvailable()) return;
  if (!(await getPushPreference()) || !isAuthenticated()) return;
  await enablePushNotifications();
}

/** Re-fetch the Expo token when the OS rolls it, as recommended by Expo. */
export function watchPushTokenChanges(): { remove: () => void } {
  if (!isRemotePushAvailable()) return { remove: () => undefined };
  return Notifications.addPushTokenListener(() => {
    void syncPushRegistration();
  });
}

export async function sendTestNotification(): Promise<{ ok: boolean; message?: string }> {
  const unavailable = getRemotePushUnavailableMessage();
  if (unavailable) return { ok: false, message: unavailable };
  if (!(await getPushPreference())) {
    return { ok: false, message: "Turn on push notifications first." };
  }
  try {
    const data = await apiJson<{ sent: number }>("/api/v1/push/test", {
      method: "POST",
      body: "{}",
    });
    return data.sent > 0
      ? { ok: true }
      : { ok: false, message: "No device token is registered yet." };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Could not send the test notification." };
  }
}
