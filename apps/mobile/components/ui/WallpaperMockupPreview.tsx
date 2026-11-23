import { useEffect, useState, type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

export type WallpaperMockupMode = "off" | "lock" | "home";
export type WallpaperMockupPlatform = "ios" | "android";

type IconName = ComponentProps<typeof Ionicons>["name"];
type AppIcon = { name: IconName; color: string; label: string };

const IOS_APPS: readonly AppIcon[] = [
  { name: "camera", color: "#8E8E93", label: "Camera" },
  { name: "chatbubble", color: "#34C759", label: "Messages" },
  { name: "mail", color: "#0A84FF", label: "Mail" },
  { name: "musical-notes", color: "#FF2D55", label: "Music" },
  { name: "map", color: "#30D158", label: "Maps" },
  { name: "images", color: "#FF9F0A", label: "Photos" },
  { name: "time", color: "#1C1C1E", label: "Clock" },
  { name: "calendar", color: "#FF453A", label: "Calendar" },
  { name: "newspaper", color: "#64D2FF", label: "News" },
  { name: "play", color: "#F5C518", label: "TV" },
  { name: "wallet", color: "#5E5CE6", label: "Wallet" },
  { name: "book", color: "#FF9F0A", label: "Books" },
  { name: "compass", color: "#0A84FF", label: "Safari" },
  { name: "settings", color: "#8E8E93", label: "Settings" },
  { name: "heart", color: "#FF375F", label: "Health" },
  { name: "cloud", color: "#64D2FF", label: "Weather" },
];

const ANDROID_APPS: readonly AppIcon[] = [
  { name: "call", color: "#3DDC84", label: "Phone" },
  { name: "chatbubble", color: "#34A853", label: "Messages" },
  { name: "camera", color: "#4285F4", label: "Camera" },
  { name: "images", color: "#EA4335", label: "Photos" },
  { name: "mail", color: "#4285F4", label: "Gmail" },
  { name: "map", color: "#34A853", label: "Maps" },
  { name: "play", color: "#EA4335", label: "Play" },
  { name: "musical-notes", color: "#F62E63", label: "Music" },
  { name: "newspaper", color: "#5F6368", label: "News" },
  { name: "time", color: "#5F6368", label: "Clock" },
  { name: "calendar", color: "#4285F4", label: "Calendar" },
  { name: "settings", color: "#5F6368", label: "Settings" },
  { name: "cloud", color: "#4285F4", label: "Weather" },
  { name: "wallet", color: "#7B1FA2", label: "Wallet" },
  { name: "book", color: "#F9AB00", label: "Books" },
  { name: "fitness", color: "#EA4335", label: "Fit" },
  { name: "compass", color: "#4285F4", label: "Explore" },
  { name: "flashlight-outline", color: "#5F6368", label: "Torch" },
  { name: "radio", color: "#F62E63", label: "Radio" },
  { name: "people", color: "#34A853", label: "Contacts" },
];

const MODES: { value: WallpaperMockupMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "lock", label: "Lock" },
  { value: "home", label: "Home" },
];

const PLATFORMS: { value: WallpaperMockupPlatform; label: string }[] = [
  { value: "ios", label: "iPhone" },
  { value: "android", label: "Android" },
];

function useLiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function formatTime(now: Date) {
  return now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDate(now: Date) {
  return now
    .toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    .toUpperCase();
}

function StatusBar({ time, ios }: { time: string; ios: boolean }) {
  return (
    <View style={[styles.statusBar, ios && styles.statusBarIos]}>
      <Text style={styles.statusTime}>{time}</Text>
      <View style={styles.statusIcons}>
        <Ionicons name="cellular" size={12} color="#FFFFFF" />
        <Ionicons name="wifi" size={12} color="#FFFFFF" />
        <Ionicons name="battery-full" size={14} color="#FFFFFF" />
      </View>
    </View>
  );
}

function MockNotification({
  icon,
  title,
  body,
  tint,
}: {
  icon: IconName;
  title: string;
  body: string;
  tint: string;
}) {
  return (
    <View style={styles.notification}>
      <View style={[styles.notificationIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={13} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.notificationTitle}>{title}</Text>
        <Text style={styles.notificationBody} numberOfLines={1}>
          {body}
        </Text>
      </View>
      <Text style={styles.notificationTime}>now</Text>
    </View>
  );
}

function AppGrid({ apps, android }: { apps: readonly AppIcon[]; android: boolean }) {
  return (
    <View style={styles.appGrid}>
      {apps.map((app, index) => (
        <View key={`${app.label}-${index}`} style={styles.appSlot}>
          <View
            style={[
              styles.appTile,
              android ? styles.appTileAndroid : styles.appTileIos,
              { backgroundColor: app.color },
            ]}
          >
            <Ionicons name={app.name} size={android ? 17 : 16} color="#FFFFFF" />
          </View>
          <Text style={[styles.appLabel, android && styles.appLabelAndroid]} numberOfLines={1}>
            {app.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function LockMockup({
  platform,
  time,
  date,
  accentColor,
}: {
  platform: WallpaperMockupPlatform;
  time: string;
  date: string;
  accentColor: string;
}) {
  const ios = platform === "ios";
  return (
    <>
      <StatusBar time={time} ios={ios} />
      <View style={[styles.lockClockBlock, ios ? styles.iosLockClock : styles.androidLockClock]}>
        <Text style={[styles.lockDate, ios && styles.iosLockDate]}>{date}</Text>
        <Text style={[styles.lockTime, ios ? styles.iosLockTime : styles.androidLockTime]}>{time}</Text>
      </View>

      <View style={styles.notificationStack}>
        <MockNotification icon="sparkles" title="WALLORA" body="Fresh walls for today" tint={accentColor} />
        {ios ? (
          <MockNotification icon="sunny-outline" title="Weather" body="Partly cloudy · 28°" tint="#0A84FF" />
        ) : null}
      </View>

      {ios ? (
        <View style={styles.lockFooter}>
          <View style={styles.lockTool}>
            <Ionicons name="flashlight-outline" size={17} color="#FFFFFF" />
          </View>
          <View style={styles.swipePill}>
            <Text style={styles.swipeText}>Swipe up to open</Text>
          </View>
          <View style={styles.lockTool}>
            <Ionicons name="camera-outline" size={17} color="#FFFFFF" />
          </View>
        </View>
      ) : (
        <View style={styles.androidLockFooter}>
          <Text style={styles.androidSwipeText}>Swipe up to unlock</Text>
          <View style={styles.androidNav}>
            <Ionicons name="triangle-outline" size={13} color="#FFFFFF" />
            <View style={styles.navCircle} />
            <View style={styles.navSquare} />
          </View>
        </View>
      )}
    </>
  );
}

function HomeMockup({
  platform,
  time,
}: {
  platform: WallpaperMockupPlatform;
  time: string;
}) {
  const ios = platform === "ios";
  return (
    <>
      <StatusBar time={time} ios={ios} />
      {ios ? (
        <>
          <View style={styles.homeSearch}>
            <Ionicons name="search-outline" size={13} color="#FFFFFF" />
            <Text style={styles.homeSearchText}>Search</Text>
          </View>
          <AppGrid apps={IOS_APPS} android={false} />
          <View style={styles.pageDots}>
            <View style={[styles.pageDot, styles.pageDotActive]} />
            <View style={styles.pageDot} />
            <View style={styles.pageDot} />
          </View>
          <View style={styles.iosDock}>
            {IOS_APPS.slice(0, 4).map((app) => (
              <View key={`dock-${app.label}`} style={[styles.dockTile, { backgroundColor: app.color }]}>
                <Ionicons name={app.name} size={17} color="#FFFFFF" />
              </View>
            ))}
          </View>
        </>
      ) : (
        <>
          <View style={[styles.homeSearch, styles.androidSearch]}>
            <Ionicons name="search-outline" size={13} color="#FFFFFF" />
            <Text style={styles.homeSearchText}>Search apps</Text>
          </View>
          <AppGrid apps={ANDROID_APPS} android />
          <View style={styles.androidDock}>
            {ANDROID_APPS.slice(0, 4).map((app) => (
              <View key={`dock-${app.label}`} style={[styles.appTile, styles.appTileAndroid, { backgroundColor: app.color }]}>
                <Ionicons name={app.name} size={17} color="#FFFFFF" />
              </View>
            ))}
          </View>
          <View style={styles.gesturePill} />
        </>
      )}
    </>
  );
}

export function WallpaperMockupControls({
  mode,
  platform,
  onMode,
  onPlatform,
}: {
  mode: WallpaperMockupMode;
  platform: WallpaperMockupPlatform;
  onMode: (value: WallpaperMockupMode) => void;
  onPlatform: (value: WallpaperMockupPlatform) => void;
}) {
  return (
    <View style={styles.controlsWrap}>
      <View style={styles.controlsHeader}>
        <Text style={styles.controlsTitle}>Preview on your phone</Text>
        <Text style={styles.controlsHint}>Live clock · simulated icons</Text>
      </View>
      <View style={styles.controlRows}>
        <View style={styles.segment}>
          {MODES.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => onMode(item.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === item.value }}
              style={[styles.segmentChip, mode === item.value && styles.segmentChipActive]}
            >
              <Text style={[styles.segmentText, mode === item.value && styles.segmentTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.segment}>
          {PLATFORMS.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => onPlatform(item.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: platform === item.value }}
              style={[styles.segmentChip, platform === item.value && styles.segmentChipActive]}
            >
              <Text style={[styles.segmentText, platform === item.value && styles.segmentTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

export function WallpaperMockupOverlay({
  mode,
  platform,
  accentColor = "#D7B879",
}: {
  mode: WallpaperMockupMode;
  platform: WallpaperMockupPlatform;
  accentColor?: string | null;
}) {
  const now = useLiveClock();
  if (mode === "off") return null;

  const time = formatTime(now);
  const date = formatDate(now);
  const tint = accentColor ?? "#D7B879";

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View style={[styles.overlayScrim, platform === "ios" ? styles.iosScrim : styles.androidScrim]} />
      <View style={styles.overlayContent}>
        {mode === "lock" ? (
          <LockMockup platform={platform} time={time} date={date} accentColor={tint} />
        ) : (
          <HomeMockup platform={platform} time={time} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controlsWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 10,
  },
  controlsHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  controlsTitle: { color: "#F7F7F5", fontSize: 13, fontWeight: "700" },
  controlsHint: { color: "#9296A1", fontSize: 10 },
  controlRows: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segment: {
    flexDirection: "row",
    backgroundColor: "#14161B",
    borderWidth: 1,
    borderColor: "#292C33",
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  segmentChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7 },
  segmentChipActive: { backgroundColor: "#D7B879" },
  segmentText: { color: "#9296A1", fontSize: 11, fontWeight: "700" },
  segmentTextActive: { color: "#0B0C0F" },

  overlay: { ...StyleSheet.absoluteFill, zIndex: 1 },
  overlayScrim: { ...StyleSheet.absoluteFill },
  iosScrim: { backgroundColor: "rgba(0,0,0,0.28)" },
  androidScrim: { backgroundColor: "rgba(0,0,0,0.34)" },
  overlayContent: {
    flex: 1,
    paddingTop: 54,
    paddingBottom: 18,
    paddingHorizontal: 18,
  },

  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 18,
  },
  statusBarIos: { marginBottom: 2 },
  statusTime: { color: "#FFFFFF", fontSize: 11, fontWeight: "700", textShadowColor: "#000", textShadowRadius: 3 },
  statusIcons: { flexDirection: "row", alignItems: "center", gap: 4 },

  lockClockBlock: { alignItems: "flex-start" },
  iosLockClock: { alignItems: "center", marginTop: 20 },
  androidLockClock: { marginTop: 26 },
  lockDate: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.1,
    textShadowColor: "#000",
    textShadowRadius: 4,
  },
  iosLockDate: { fontSize: 10 },
  lockTime: {
    color: "#FFFFFF",
    fontSize: 52,
    fontWeight: "200",
    lineHeight: 58,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  iosLockTime: { fontSize: 64, lineHeight: 70, fontWeight: "300" },
  androidLockTime: { fontSize: 54, lineHeight: 60, fontWeight: "300" },

  notificationStack: { marginTop: "auto", gap: 8 },
  notification: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "rgba(28,28,30,0.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  notificationIcon: { width: 24, height: 24, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  notificationTitle: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  notificationBody: { color: "rgba(255,255,255,0.78)", fontSize: 10, marginTop: 1 },
  notificationTime: { color: "rgba(255,255,255,0.62)", fontSize: 9 },

  lockFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
  lockTool: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.38)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  swipePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.34)",
  },
  swipeText: { color: "rgba(255,255,255,0.9)", fontSize: 10, fontWeight: "600" },
  androidLockFooter: { alignItems: "center", gap: 12, marginTop: 14 },
  androidSwipeText: { color: "rgba(255,255,255,0.82)", fontSize: 10, fontWeight: "600" },
  androidNav: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 22, width: "100%" },
  navCircle: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: "#FFFFFF" },
  navSquare: { width: 11, height: 11, borderRadius: 2, borderWidth: 2, borderColor: "#FFFFFF" },

  homeSearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "center",
    width: "72%",
    marginTop: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  androidSearch: { width: "100%", borderRadius: 10, backgroundColor: "rgba(0,0,0,0.24)" },
  homeSearchText: { color: "rgba(255,255,255,0.82)", fontSize: 10 },
  appGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 20,
    rowGap: 14,
  },
  appSlot: { width: "22%", alignItems: "center", gap: 4 },
  appTile: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  appTileIos: { borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  appTileAndroid: { borderRadius: 19 },
  appLabel: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "600",
    textShadowColor: "#000",
    textShadowRadius: 3,
    maxWidth: "100%",
  },
  appLabelAndroid: { fontSize: 8 },
  pageDots: { flexDirection: "row", alignSelf: "center", gap: 5, marginTop: "auto", marginBottom: 10 },
  pageDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.42)" },
  pageDotActive: { backgroundColor: "#FFFFFF", width: 13 },
  iosDock: {
    flexDirection: "row",
    alignSelf: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  dockTile: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  androidDock: {
    flexDirection: "row",
    alignSelf: "center",
    gap: 18,
    marginTop: "auto",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.26)",
  },
  gesturePill: {
    alignSelf: "center",
    width: 78,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.78)",
    marginTop: 10,
  },
});
