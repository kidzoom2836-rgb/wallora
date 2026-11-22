import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ScreenHeader } from "../components/ui/ScreenHeader";
import { VerifiedBadge } from "../components/ui/VerifiedBadge";
import { apiJson } from "../lib/api";
import { C, R, S, tierMeta } from "../lib/theme";
import { useAuth } from "../lib/auth";

type AppSettings = {
  theme: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  aiPreferenceMode: string;
  preferredImageStyles: string;
  preferredCategories: string;
};

type MeResponse = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  verificationTier?: string;
  profile?: {
    username?: string;
    displayName?: string;
    bio?: string | null;
    avatarUrl?: string | null;
    verified?: boolean;
  } | null;
};

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  emailNotifications: true,
  pushNotifications: false,
  aiPreferenceMode: "creative-assistant",
  preferredImageStyles: "",
  preferredCategories: "",
};

const AI_MODES = [
  { value: "creative-assistant", label: "Creative" },
  { value: "precise", label: "Precise" },
  { value: "concise", label: "Concise" },
  { value: "collaborative", label: "Collaborative" },
];

function Banner({ message, tone }: { message: string; tone: "success" | "error" | "info" }) {
  if (!message) return null;
  const color = tone === "success" ? C.success : tone === "error" ? C.error : C.blue;
  const icon =
    tone === "success" ? "checkmark-circle-outline" : tone === "error" ? "alert-circle-outline" : "information-circle-outline";
  return (
    <View style={[styles.banner, { borderColor: color + "55" }]}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.bannerText, { color }]}>{message}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, loading: authLoading, refresh } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [account, setAccount] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "error" | "info" } | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [savedSettings, me] = await Promise.all([
        apiJson<Partial<AppSettings>>("/api/v1/settings"),
        apiJson<MeResponse>("/api/v1/auth/me"),
      ]);
      if (savedSettings && typeof savedSettings === "object") {
        setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });
      }
      setAccount(me);
      setDisplayName(me?.profile?.displayName ?? me?.name ?? "");
      setBio(me?.profile?.bio ?? "");
    } catch (e: any) {
      setError(e?.message ?? "Could not load your settings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const saveProfile = async () => {
    if (savingProfile) return;
    if (displayName.trim().length < 2) {
      setNotice({ text: "Display name must be at least 2 characters.", tone: "error" });
      return;
    }
    setSavingProfile(true);
    setNotice(null);
    setError(null);
    try {
      await apiJson("/api/v1/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ displayName: displayName.trim(), bio: bio.trim() }),
      });
      await refresh();
      setNotice({ text: "Profile saved on WALLORA.", tone: "success" });
    } catch (e: any) {
      setError(e?.message ?? "Could not save your profile.");
      setNotice({ text: e?.message ?? "Could not save your profile.", tone: "error" });
    } finally {
      setSavingProfile(false);
    }
  };

  const saveSettings = async () => {
    if (savingSettings) return;
    setSavingSettings(true);
    setNotice(null);
    setError(null);
    try {
      await apiJson("/api/v1/settings", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      await load();
      setNotice({ text: "Settings saved on WALLORA.", tone: "success" });
    } catch (e: any) {
      setError(e?.message ?? "Could not save your settings.");
      setNotice({ text: e?.message ?? "Could not save your settings.", tone: "error" });
    } finally {
      setSavingSettings(false);
    }
  };

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (authLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={C.accent} size="large" />
        <Text style={styles.stateText}>Checking your account…</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Settings" subtitle="WALLORA account preferences" />
        <View style={styles.center}>
          <Ionicons name="settings-outline" size={44} color={C.accent} />
          <Text style={styles.stateTitle}>Sign in to manage settings</Text>
          <Text style={styles.stateSub}>Your preferences and profile are saved to your WALLORA account.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.push("/auth/login")}>
            <Text style={styles.primaryButtonText}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const tier = account?.verificationTier ?? "free";

  return (
    <View style={styles.root}>
      <ScreenHeader title="Settings" subtitle="Profile, notifications and AI preferences" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={C.accent}
          />
        }
      >
        {notice ? <Banner message={notice.text} tone={notice.tone} /> : null}
        {error && !notice ? <Banner message={error} tone="error" /> : null}

        {loading ? (
          <View style={styles.inlineState}>
            <ActivityIndicator color={C.accent} size="small" />
            <Text style={styles.stateText}>Loading your settings…</Text>
          </View>
        ) : null}

        <View style={styles.accountCard}>
          <View style={styles.accountTop}>
            <View style={styles.accountIcon}>
              <Ionicons name="person-outline" size={22} color={C.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.accountName} numberOfLines={1}>
                {account?.profile?.displayName ?? user.name ?? "WALLORA user"}
              </Text>
              <Text style={styles.accountEmail} numberOfLines={1}>
                {account?.email ?? user.email ?? ""}
              </Text>
            </View>
            <VerifiedBadge tier={tier} size="sm" />
          </View>
          <View style={styles.accountMeta}>
            <Text style={styles.metaText}>@{account?.profile?.username ?? user.username ?? "unknown"}</Text>
            <Text style={styles.metaDivider}>·</Text>
            <Text style={styles.metaText}>{tierMeta(tier).label}</Text>
            {account?.role ? (
              <>
                <Text style={styles.metaDivider}>·</Text>
                <Text style={styles.metaText}>{account.role}</Text>
              </>
            ) : null}
          </View>
        </View>

        <Text style={styles.sectionLabel}>PROFILE</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Display name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your display name"
            placeholderTextColor={C.muted}
            style={styles.input}
            maxLength={80}
          />
          <Text style={styles.fieldLabel}>Bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell the community what you create"
            placeholderTextColor={C.muted}
            style={[styles.input, styles.textArea]}
            multiline
            textAlignVertical="top"
            maxLength={500}
          />
          <Pressable
            onPress={() => void saveProfile()}
            disabled={savingProfile || loading}
            style={[styles.saveButton, (savingProfile || loading) && styles.buttonDisabled]}
          >
            {savingProfile ? (
              <ActivityIndicator color={C.bg} size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={16} color={C.bg} />
                <Text style={styles.saveButtonText}>Save profile</Text>
              </>
            )}
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>APPEARANCE</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="moon-outline" size={18} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Theme</Text>
              <Text style={styles.rowSub}>WALLORA mobile is dark-only in this release.</Text>
            </View>
            <View style={styles.lockedBadge}>
              <Ionicons name="lock-closed-outline" size={12} color={C.muted} />
              <Text style={styles.lockedText}>Dark</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="mail-outline" size={18} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Email notifications</Text>
              <Text style={styles.rowSub}>Product updates and account activity.</Text>
            </View>
            <Switch
              value={!!settings.emailNotifications}
              onValueChange={(value) => update("emailNotifications", value)}
              trackColor={{ false: C.raised, true: C.accent }}
              thumbColor={C.text}
            />
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="notifications-outline" size={18} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Push notifications</Text>
              <Text style={styles.rowSub}>Replies, follows and project shoutouts.</Text>
            </View>
            <Switch
              value={!!settings.pushNotifications}
              onValueChange={(value) => update("pushNotifications", value)}
              trackColor={{ false: C.raised, true: C.accent }}
              thumbColor={C.text}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>AI PREFERENCES</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Assistant mode</Text>
          <View style={styles.modeRow}>
            {AI_MODES.map((mode) => (
              <Pressable
                key={mode.value}
                onPress={() => update("aiPreferenceMode", mode.value)}
                style={[styles.modeChip, settings.aiPreferenceMode === mode.value && styles.modeChipActive]}
              >
                <Text style={[styles.modeText, settings.aiPreferenceMode === mode.value && styles.modeTextActive]}>
                  {mode.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Preferred image styles</Text>
          <TextInput
            value={settings.preferredImageStyles}
            onChangeText={(value) => update("preferredImageStyles", value)}
            placeholder="editorial, cinematic, minimal…"
            placeholderTextColor={C.muted}
            style={styles.input}
            maxLength={300}
          />
          <Text style={styles.fieldLabel}>Preferred categories</Text>
          <TextInput
            value={settings.preferredCategories}
            onChangeText={(value) => update("preferredCategories", value)}
            placeholder="nature, abstract, gaming…"
            placeholderTextColor={C.muted}
            style={styles.input}
            maxLength={300}
          />
          <Pressable
            onPress={() => void saveSettings()}
            disabled={savingSettings || loading}
            style={[styles.saveButton, (savingSettings || loading) && styles.buttonDisabled]}
          >
            {savingSettings ? (
              <ActivityIndicator color={C.bg} size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={16} color={C.bg} />
                <Text style={styles.saveButtonText}>Save settings</Text>
              </>
            )}
          </Pressable>
        </View>

        <Text style={styles.footerNote}>Preferences are stored by the WALLORA web API, not only on this device.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: S.xxl, gap: S.md },
  content: { padding: S.lg, paddingBottom: S.xxxl },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: S.sm,
    borderWidth: 1,
    borderRadius: R.md,
    backgroundColor: C.card,
    padding: S.md,
    marginTop: S.sm,
  },
  bannerText: { flex: 1, fontSize: 12, lineHeight: 18 },
  inlineState: { flexDirection: "row", alignItems: "center", gap: S.sm, paddingVertical: S.lg },
  accountCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: S.md,
    marginTop: S.lg,
  },
  accountTop: { flexDirection: "row", alignItems: "center", gap: S.sm },
  accountIcon: {
    width: 44,
    height: 44,
    borderRadius: R.md,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  accountName: { fontSize: 15, fontWeight: "800", color: C.text },
  accountEmail: { fontSize: 12, color: C.muted, marginTop: 2 },
  accountMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5, marginTop: S.md },
  metaText: { fontSize: 11, color: C.muted },
  metaDivider: { fontSize: 11, color: C.mutedDark },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: "800",
    color: C.accent,
    marginTop: S.xl,
    marginBottom: S.sm,
  },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: S.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: S.sm, paddingVertical: S.sm },
  rowDivider: { height: 1, backgroundColor: C.borderSoft },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: R.sm,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { color: C.text, fontSize: 13, fontWeight: "700" },
  rowSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.pill,
    paddingHorizontal: S.sm,
    paddingVertical: 5,
  },
  lockedText: { color: C.textSoft, fontSize: 11, fontWeight: "700" },
  fieldLabel: { color: C.textSoft, fontSize: 12, fontWeight: "700", marginTop: S.md, marginBottom: S.sm },
  input: {
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    color: C.text,
    fontSize: 13,
    paddingHorizontal: S.md,
    paddingVertical: 11,
  },
  textArea: { minHeight: 90, lineHeight: 19 },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: S.sm },
  modeChip: {
    paddingHorizontal: S.md,
    paddingVertical: 8,
    borderRadius: R.pill,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
  },
  modeChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  modeText: { fontSize: 12, fontWeight: "700", color: C.muted },
  modeTextActive: { color: C.bg },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: C.accent,
    borderRadius: R.md,
    paddingVertical: 12,
    marginTop: S.lg,
  },
  saveButtonText: { color: C.bg, fontSize: 13, fontWeight: "800" },
  buttonDisabled: { opacity: 0.6 },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accent,
    borderRadius: R.md,
    paddingHorizontal: S.xl,
    paddingVertical: 12,
    marginTop: S.sm,
  },
  primaryButtonText: { color: C.bg, fontSize: 13, fontWeight: "800" },
  stateTitle: { fontSize: 16, fontWeight: "800", color: C.text, textAlign: "center" },
  stateText: { fontSize: 12, color: C.muted, textAlign: "center" },
  stateSub: { fontSize: 12, color: C.muted, textAlign: "center", lineHeight: 18 },
  footerNote: { color: C.mutedDark, fontSize: 11, lineHeight: 17, marginTop: S.xl, textAlign: "center" },
});
