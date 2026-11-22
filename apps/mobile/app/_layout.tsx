import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import { AuthProvider } from "../lib/auth";
import { OfflineBanner } from "../components/ui/OfflineBanner";
import { syncPushRegistration, watchPushTokenChanges } from "../lib/pushNotifications";

function useNotificationNavigation() {
  const router = useRouter();

  useEffect(() => {
    const redirect = (notification: Notifications.Notification) => {
      const url = notification.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) {
        router.push(url as never);
      }
    };

    const initial = Notifications.getLastNotificationResponse();
    if (initial) redirect(initial.notification);
    Notifications.clearLastNotificationResponse();

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      redirect(response.notification);
      Notifications.clearLastNotificationResponse();
    });
    return () => subscription.remove();
  }, [router]);
}

export default function RootLayout() {
  useNotificationNavigation();

  useEffect(() => {
    void syncPushRegistration();
    const tokenSubscription = watchPushTokenChanges();
    return () => tokenSubscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0B0C0F" }}>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0B0C0F" } }} />
        <OfflineBanner />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
