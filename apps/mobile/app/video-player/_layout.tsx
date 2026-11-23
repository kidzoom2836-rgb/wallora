import { Stack } from "expo-router";

import { C } from "../../lib/theme";

/** The video area has its own library, full-screen player and settings. */
export default function VideoPlayerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: C.bg },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="player"
        options={{ animation: "fade", gestureEnabled: false }}
      />
      <Stack.Screen name="settings" options={{ presentation: "modal" }} />
    </Stack>
  );
}
