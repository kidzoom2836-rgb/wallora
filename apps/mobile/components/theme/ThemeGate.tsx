import { lazy, Suspense, useEffect, useState } from "react";
import { View } from "react-native";

import { hydrateAppTheme } from "../../lib/appThemes";
import { C } from "../../lib/theme";

// Loaded only after the persisted palette has been applied, so every screen's
// module-level StyleSheet.create() uses the selected theme.
const RootNavigator = lazy(() => import("../navigation/RootNavigator"));

/** Applies the saved WALLORA theme before mounting any themed screen. */
export function ThemeGate() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void hydrateAppTheme().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  }

  return (
    <Suspense fallback={<View style={{ flex: 1, backgroundColor: C.bg }} />}>
      <RootNavigator />
    </Suspense>
  );
}
