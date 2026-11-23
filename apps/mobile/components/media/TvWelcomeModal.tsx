import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { C, R, SHADOW } from "../../lib/theme";

export const TV_TERMS_ACCEPTED_KEY = "wallora.tv.termsAccepted.v1";
const TV_WELCOME_SEEN_KEY = "wallora.tv.welcomeSeen.v1";

/** Live TV stays locked until this key is stored. */
export async function hasAcceptedTvTerms(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(TV_TERMS_ACCEPTED_KEY);
    return value === "1" || value === "true";
  } catch {
    return false;
  }
}

/** Persist both the terms acceptance and the one-time welcome marker. */
export async function acceptTvTerms(): Promise<void> {
  try {
    await AsyncStorage.setItem(TV_TERMS_ACCEPTED_KEY, "1");
    await AsyncStorage.setItem(TV_WELCOME_SEEN_KEY, "1");
  } catch {
    // Keep the in-memory unlock working even if storage is unavailable.
  }
}

const FEATURES: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}[] = [
  {
    icon: "tv-outline",
    title: "1,400+ channels",
    body: "A huge guide of live news, sport, movies, kids and music channels.",
  },
  {
    icon: "flash-outline",
    title: "Real-time streaming",
    body: "Jump straight into a live stream in fullscreen or Picture-in-Picture.",
  },
  {
    icon: "people-outline",
    title: "Community recommendations",
    body: "See what WALLORA members watch and share channels you love.",
  },
];

/** One-time welcome + Terms & Service gate for Live TV. */
export function TvWelcomeModal({
  visible,
  onAccept,
  onLater,
}: {
  visible: boolean;
  onAccept: () => void;
  onLater: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const handleAccept = async () => {
    if (busy) return;
    setBusy(true);
    await acceptTvTerms();
    setBusy(false);
    onAccept();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onLater}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <LinearGradient
              colors={[C.accentDim, C.bgElevated]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View style={styles.heroIcon}>
                <Ionicons name="sparkles-outline" size={26} color={C.accent} />
              </View>
              <Text style={styles.eyebrow}>WALLORA LIVE TV</Text>
              <Text style={styles.title}>Welcome to WALLORA TV</Text>
              <Text style={styles.subtitle}>
                Your premium live-streaming lounge. Pick a channel and watch in
                seconds.
              </Text>
            </LinearGradient>

            <View style={styles.body}>
              <View style={styles.features}>
                {FEATURES.map((feature) => (
                  <View style={styles.feature} key={feature.title}>
                    <View style={styles.featureIcon}>
                      <Ionicons
                        name={feature.icon}
                        size={17}
                        color={C.accentBright}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featureTitle}>{feature.title}</Text>
                      <Text style={styles.featureBody}>{feature.body}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.terms}>
                <View style={styles.termsHeading}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={15}
                    color={C.accent}
                  />
                  <Text style={styles.termsTitle}>Terms &amp; Service</Text>
                </View>
                <Text style={styles.termsText}>
                  WALLORA is a discovery and playback layer for third-party
                  M3U streams. We do not host, own or control the channels you
                  open. Streams may be unavailable or change without notice.
                  You agree to use Live TV lawfully, respect broadcaster and
                  content rights, and not use it to distribute unlawful material.
                  Your watch history and recent searches stay on this device
                  unless you choose to share a recommendation.
                </Text>
              </View>

              <Pressable
                onPress={handleAccept}
                disabled={busy}
                style={({ pressed }) => [
                  styles.primary,
                  pressed && styles.pressed,
                  busy && styles.disabled,
                ]}
              >
                <Ionicons name="checkmark-circle" size={18} color={C.bg} />
                <Text style={styles.primaryText}>I accept &amp; continue</Text>
              </Pressable>
              <Pressable onPress={onLater} style={styles.secondary}>
                <Text style={styles.secondaryText}>Not now</Text>
              </Pressable>
              <Text style={styles.footerNote}>
                Playback stays paused until you accept.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
    backgroundColor: "rgba(0,0,0,0.82)",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "92%",
    borderRadius: R.xl,
    overflow: "hidden",
    backgroundColor: C.bgElevated,
    borderWidth: 1,
    borderColor: C.border,
    ...SHADOW.hero,
  },
  hero: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20 },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
  },
  eyebrow: {
    color: C.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
  title: {
    color: C.text,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 0.3,
    marginTop: 6,
  },
  subtitle: {
    color: C.textSoft,
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 8,
  },
  body: { paddingHorizontal: 22, paddingBottom: 24 },
  features: { gap: 12, paddingVertical: 18 },
  feature: { flexDirection: "row", gap: 11, alignItems: "flex-start" },
  featureIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentDim,
  },
  featureTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  featureBody: {
    color: C.muted,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 2,
  },
  terms: {
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    padding: 13,
  },
  termsHeading: { flexDirection: "row", alignItems: "center", gap: 7 },
  termsTitle: { color: C.accentBright, fontSize: 12, fontWeight: "800" },
  termsText: {
    color: C.textSoft,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 8,
  },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: R.md,
    backgroundColor: C.accent,
    paddingVertical: 14,
    marginTop: 18,
    ...SHADOW.glowGold,
  },
  primaryText: { color: C.bg, fontSize: 13.5, fontWeight: "900" },
  secondary: { alignItems: "center", paddingVertical: 13 },
  secondaryText: { color: C.muted, fontSize: 12.5, fontWeight: "600" },
  footerNote: {
    color: C.mutedDark,
    fontSize: 10,
    textAlign: "center",
    marginTop: -4,
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
});
