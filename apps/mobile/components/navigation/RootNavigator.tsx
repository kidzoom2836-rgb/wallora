import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";

import { AuthProvider } from "../../lib/auth";
import { OfflineBanner } from "../ui/OfflineBanner";
import { PromoPopupHost } from "../media/PromoPopupHost";
import { syncPushRegistration, watchPushTokenChanges } from "../../lib/pushNotifications";
import { C } from "../../lib/theme";

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

/** The real app tree, mounted only after the saved theme has been applied. */
export default function RootNavigator() {
  useNotificationNavigation();

  useEffect(() => {
    void syncPushRegistration();
    const tokenSubscription = watchPushTokenChanges();
    return () => tokenSubscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
        <OfflineBanner />
        <PromoPopupHost />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
