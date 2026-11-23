import { Stack } from "expo-router";

import { C } from "../../lib/theme";

/** WALLORA TV is a small navigator: guide, full-screen player and settings. */
export default function LiveTvLayout() {
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
      <Stack.Screen name="reminders" options={{ presentation: "modal" }} />
    </Stack>
  );
}
