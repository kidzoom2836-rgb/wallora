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
  Image,
  Modal,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ScreenHeader } from "../components/ui/ScreenHeader";
import { VerifiedBadge } from "../components/ui/VerifiedBadge";
import { apiFetch, apiJson } from "../lib/api";
import { APP_THEMES, getActiveThemeId, selectAppTheme, type AppThemeId } from "../lib/appThemes";
import { assetUrl } from "../lib/config";
import { C, R, S, tierMeta } from "../lib/theme";
import { useAuth } from "../lib/auth";
import { pickImages, uploadImages, type PickedImage } from "../lib/uploads";
import { withVerification } from "../lib/verification";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushPreference,
  getRemotePushUnavailableMessage,
  sendTestNotification,
} from "../lib/pushNotifications";

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
  image?: string | null;
  role?: string;
  verificationTier?: string;
  profile?: {
    username?: string;
    displayName?: string;
    bio?: string | null;
    avatarUrl?: string | null;
    coverUrl?: string | null;
    verified?: boolean;
  } | null;
};

type MediaKind = "avatar" | "cover";

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
  const { user, loading: authLoading, refresh, signOut } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [account, setAccount] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [avatarPick, setAvatarPick] = useState<PickedImage | null>(null);
  const [coverPick, setCoverPick] = useState<PickedImage | null>(null);
  const [uploading, setUploading] = useState<MediaKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "error" | "info" } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [appThemeId, setAppThemeId] = useState<AppThemeId>(() => getActiveThemeId());
  const [themeBusy, setThemeBusy] = useState(false);
  const pushUnavailable = getRemotePushUnavailableMessage();
  const pushDisabled = !settings.pushNotifications || !!pushUnavailable;

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
        const localPush = await getPushPreference();
        setSettings({
          ...DEFAULT_SETTINGS,
          ...savedSettings,
          pushNotifications: localPush || !!savedSettings.pushNotifications,
        });
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

  const changeTheme = async (id: AppThemeId) => {
    if (themeBusy || id === appThemeId) return;
    setThemeBusy(true);
    setNotice(null);
    const changed = await selectAppTheme(id);
    setAppThemeId(id);
    setNotice({
      text: changed ? "Theme applied. Rebuilding WALLORA…" : "That theme is already active.",
      tone: "success",
    });
    setThemeBusy(false);
  };

  const pickMedia = async (kind: MediaKind) => {
    if (uploading) return;
    setNotice(null);
    setError(null);
    try {
      // Single image only; the crop aspect matches the web profile editor.
      const images = await pickImages("library", {
        max: 1,
        quality: 0.85,
        aspect: kind === "avatar" ? [1, 1] : [16, 9],
      });
      const picked = images[0];
      if (!picked) return;
      if (kind === "avatar") setAvatarPick(picked);
      else setCoverPick(picked);
    } catch (e: any) {
      const message = e?.message ?? "Could not choose that image.";
      setError(message);
      setNotice({ text: message, tone: "error" });
    }
  };

  const uploadMedia = async (kind: MediaKind) => {
    const picked = kind === "avatar" ? avatarPick : coverPick;
    if (!picked || uploading) return;
    setUploading(kind);
    setNotice(null);
    setError(null);
    try {
      const storedKey = await withVerification(async () => {
        // Stage the single image through the shared upload pipeline, then send
        // it to the profile endpoint that owns avatar/cover normalization.
        const [staged] = await uploadImages([picked]);

        const form = new FormData();
        form.append("kind", kind);
        form.append("file", {
          uri: picked.uri,
          name: picked.fileName,
          type: picked.mimeType,
        } as unknown as Blob);

        const res = await apiFetch("/api/v1/profile/media", {
          method: "POST",
          body: form,
          rawBody: true,
        });
        let payload: any = {};
        try {
          payload = await res.json();
        } catch {
          /* non-JSON error response */
        }
        if (!res.ok) {
          throw new Error(
            payload?.error?.message ?? payload?.message ?? `Upload failed (${res.status}).`,
          );
        }
        const field = kind === "avatar" ? "avatarUrl" : "coverUrl";
        return payload?.data?.[field] ?? payload?.data?.url ?? staged?.key;
      });

      if (!storedKey) {
        setNotice({
          text: "Claim your free WALLORA tick to change your profile media.",
          tone: "info",
        });
        return;
      }

      setAccount((prev) =>
        prev
          ? {
              ...prev,
              ...(kind === "avatar" ? { image: storedKey } : {}),
              profile: {
                ...(prev.profile ?? {}),
                ...(kind === "avatar" ? { avatarUrl: storedKey } : { coverUrl: storedKey }),
              },
            }
          : prev,
      );
      if (kind === "avatar") setAvatarPick(null);
      else setCoverPick(null);
      await refresh();
      setNotice({
        text: kind === "avatar" ? "Profile photo updated." : "Cover updated.",
        tone: "success",
      });
    } catch (e: any) {
      const message = e?.message ?? "Could not save that image.";
      setError(message);
      setNotice({ text: message, tone: "error" });
    } finally {
      setUploading(null);
    }
  };

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const togglePush = async (value: boolean) => {
    if (value && pushUnavailable) {
      update("pushNotifications", false);
      setNotice({ text: pushUnavailable, tone: "info" });
      return;
    }
    update("pushNotifications", value);
    if (value) {
      const enabled = await enablePushNotifications();
      setNotice({
        text: enabled
          ? "Push notifications are active on this device."
          : "Allow notifications in your device settings to receive WALLORA alerts.",
        tone: enabled ? "success" : "info",
      });
    } else {
      await disablePushNotifications();
      setNotice({ text: "Push notifications turned off on this device.", tone: "info" });
    }
  };

  const testPush = async () => {
    const result = await sendTestNotification();
    setNotice({
      text: result.ok
        ? "Test notification sent."
        : result.message ?? "Enable push notifications first.",
      tone: result.ok ? "success" : "info",
    });
  };

  const handleSignOut = async () => {
    if (accountBusy) return;
    setAccountBusy(true);
    try {
      await signOut();
      router.replace("/auth/login");
    } catch (e: any) {
      setNotice({ text: e?.message ?? "Could not sign out.", tone: "error" });
    } finally {
      setAccountBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (accountBusy) return;
    setAccountBusy(true);
    setNotice(null);
    try {
      await apiJson("/api/v1/account", { method: "DELETE" });
      setConfirmDelete(false);
      await signOut();
      router.replace("/auth/login");
    } catch (e: any) {
      setNotice({ text: e?.message ?? "Could not delete your account.", tone: "error" });
    } finally {
      setAccountBusy(false);
    }
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
  const avatarRef =
    avatarPick?.uri ?? assetUrl(account?.profile?.avatarUrl ?? account?.image ?? user?.avatarUrl);
  const coverRef = coverPick?.uri ?? assetUrl(account?.profile?.coverUrl);

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
              {avatarRef ? (
                <Image source={{ uri: avatarRef }} style={styles.accountAvatar} resizeMode="cover" />
              ) : (
                <Ionicons name="person-outline" size={22} color={C.accent} />
              )}
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

        <Text style={styles.sectionLabel}>PROFILE MEDIA</Text>
        <View style={styles.card}>
          <View style={styles.mediaRow}>
            <View style={[styles.mediaPreview, styles.avatarPreview]}>
              {avatarRef ? (
                <Image source={{ uri: avatarRef }} style={styles.mediaImage} resizeMode="cover" />
              ) : (
                <Ionicons name="person-outline" size={22} color={C.accent} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle}>Profile photo</Text>
              <Text style={styles.rowSub}>Square image, at least 96×96 pixels.</Text>
              <Pressable
                onPress={() => void pickMedia("avatar")}
                disabled={!!uploading}
                style={({ pressed }) => [styles.chooseButton, pressed && styles.pressed]}
              >
                <Ionicons name="image-outline" size={14} color={C.accent} />
                <Text style={styles.chooseButtonText}>
                  {avatarPick ? "Change photo" : "Choose photo"}
                </Text>
              </Pressable>
            </View>
            {avatarPick ? (
              <Pressable
                onPress={() => void uploadMedia("avatar")}
                disabled={!!uploading}
                hitSlop={8}
                style={[styles.uploadButton, uploading && styles.buttonDisabled]}
              >
                {uploading === "avatar" ? (
                  <ActivityIndicator color={C.bg} size="small" />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={18} color={C.bg} />
                )}
              </Pressable>
            ) : null}
          </View>

          <View style={styles.rowDivider} />

          <View style={styles.mediaRow}>
            <View style={[styles.mediaPreview, styles.coverPreview]}>
              {coverRef ? (
                <Image source={{ uri: coverRef }} style={styles.mediaImage} resizeMode="cover" />
              ) : (
                <Ionicons name="image-outline" size={22} color={C.accent} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle}>Cover image</Text>
              <Text style={styles.rowSub}>Wide image, at least 256×256 pixels.</Text>
              <Pressable
                onPress={() => void pickMedia("cover")}
                disabled={!!uploading}
                style={({ pressed }) => [styles.chooseButton, pressed && styles.pressed]}
              >
                <Ionicons name="image-outline" size={14} color={C.accent} />
                <Text style={styles.chooseButtonText}>
                  {coverPick ? "Change cover" : "Choose cover"}
                </Text>
              </Pressable>
            </View>
            {coverPick ? (
              <Pressable
                onPress={() => void uploadMedia("cover")}
                disabled={!!uploading}
                hitSlop={8}
                style={[styles.uploadButton, uploading && styles.buttonDisabled]}
              >
                {uploading === "cover" ? (
                  <ActivityIndicator color={C.bg} size="small" />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={18} color={C.bg} />
                )}
              </Pressable>
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
              <Ionicons name="color-palette-outline" size={18} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>App theme</Text>
              <Text style={styles.rowSub}>Choose a look for WALLORA. The app refreshes once to apply it.</Text>
            </View>
          </View>
          <View style={styles.themeGrid}>
            {APP_THEMES.map((theme) => {
              const active = theme.id === appThemeId;
              return (
                <Pressable
                  key={theme.id}
                  onPress={() => void changeTheme(theme.id)}
                  disabled={themeBusy}
                  style={[styles.themeOption, active && styles.themeOptionActive]}
                >
                  <View style={styles.themeSwatches}>
                    {theme.swatches.map((color, index) => (
                      <View key={color + index} style={[styles.themeSwatch, { backgroundColor: color }]} />
                    ))}
                  </View>
                  <Text style={[styles.themeLabel, active && styles.themeLabelActive]} numberOfLines={1}>
                    {theme.label}
                  </Text>
                  <Text style={styles.themeTagline} numberOfLines={2}>
                    {theme.tagline}
                  </Text>
                  {active ? (
                    <View style={styles.themeCheck}>
                      <Ionicons name="checkmark-circle-outline" size={14} color={C.accent} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
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
              <Text style={styles.rowSub}>
                {pushUnavailable ?? "Replies, follows and project shoutouts."}
              </Text>
            </View>
            <Switch
              value={!!settings.pushNotifications && !pushUnavailable}
              onValueChange={(value) => void togglePush(value)}
              disabled={!!pushUnavailable}
              trackColor={{ false: C.raised, true: C.accent }}
              thumbColor={C.text}
            />
          </View>
          <View style={styles.rowDivider} />
          <Pressable
            onPress={() => void testPush()}
            disabled={pushDisabled}
            style={[styles.testPushButton, pushDisabled && styles.buttonDisabled]}
          >
            <Ionicons
              name="notifications-outline"
              size={15}
              color={pushDisabled ? C.muted : C.accent}
            />
            <Text style={[styles.testPushText, pushDisabled && { color: C.muted }]}>
              Send a test notification
            </Text>
          </Pressable>
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

        <Text style={styles.sectionLabel}>ACCOUNT ACCESS</Text>
        <View style={styles.card}>
          <Pressable
            onPress={() => void handleSignOut()}
            disabled={accountBusy}
            style={[styles.accountAction, accountBusy && styles.buttonDisabled]}
          >
            <View style={[styles.rowIcon, styles.actionIcon]}>
              <Ionicons name="log-out-outline" size={18} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Sign out</Text>
              <Text style={styles.rowSub}>End this WALLORA session on this device.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </Pressable>

          <View style={styles.rowDivider} />

          <Pressable
            onPress={() => setConfirmDelete(true)}
            disabled={accountBusy}
            style={[styles.accountAction, accountBusy && styles.buttonDisabled]}
          >
            <View style={[styles.rowIcon, styles.dangerIcon]}>
              <Ionicons name="trash-outline" size={18} color={C.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: C.error }]}>Delete account</Text>
              <Text style={styles.rowSub}>Remove your profile and block future sign-ins.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </Pressable>
        </View>

        <Text style={styles.footerNote}>Preferences are stored by the WALLORA web API, not only on this device.</Text>
      </ScrollView>

      <Modal
        visible={confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!accountBusy) setConfirmDelete(false);
        }}
      >
        <View style={styles.confirmBackdrop}>
          <Pressable style={styles.confirmDismiss} onPress={() => setConfirmDelete(false)} disabled={accountBusy} />
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Ionicons name="warning-outline" size={24} color={C.error} />
            </View>
            <Text style={styles.confirmTitle}>Delete your WALLORA account?</Text>
            <Text style={styles.confirmBody}>
              This signs you out everywhere, removes your profile details and hides you from creator
              search. Your public wallpapers stay in the community library. This cannot be undone here.
            </Text>
            <Pressable
              onPress={() => void handleDeleteAccount()}
              disabled={accountBusy}
              style={[styles.deleteButton, accountBusy && styles.buttonDisabled]}
            >
              {accountBusy ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <Text style={styles.deleteButtonText}>Yes, delete my account</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => setConfirmDelete(false)}
              disabled={accountBusy}
              style={[styles.cancelButton, accountBusy && styles.buttonDisabled]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    overflow: "hidden",
  },
  accountAvatar: { width: 44, height: 44 },
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
  testPushButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11 },
  testPushText: { color: C.accent, fontSize: 12, fontWeight: "700" },
  mediaRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.sm },
  mediaPreview: {
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarPreview: { width: 52, height: 52, borderRadius: 26 },
  coverPreview: { width: 72, height: 52, borderRadius: R.sm },
  mediaImage: { width: "100%", height: "100%" },
  chooseButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: S.sm,
    paddingVertical: 6,
    borderRadius: R.pill,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: S.sm,
  },
  chooseButtonText: { color: C.accent, fontSize: 11, fontWeight: "700" },
  uploadButton: {
    width: 38,
    height: 38,
    borderRadius: R.md,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.7 },
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
  themeGrid: { flexDirection: "row", flexWrap: "wrap", gap: S.sm, marginTop: S.sm },
  themeOption: {
    width: "47%",
    minHeight: 96,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.raised,
    padding: S.sm,
  },
  themeOptionActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  themeSwatches: { flexDirection: "row", gap: 4, marginBottom: S.sm },
  themeSwatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: C.border },
  themeLabel: { color: C.text, fontSize: 12, fontWeight: "800" },
  themeLabelActive: { color: C.accentBright },
  themeTagline: { color: C.muted, fontSize: 10, lineHeight: 14, marginTop: 2 },
  themeCheck: { position: "absolute", top: S.sm, right: S.sm },
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
  accountAction: { flexDirection: "row", alignItems: "center", gap: S.sm, paddingVertical: S.sm },
  actionIcon: { backgroundColor: C.accentDim },
  dangerIcon: { backgroundColor: C.errorDim },
  confirmBackdrop: { flex: 1, backgroundColor: C.overlay, alignItems: "center", justifyContent: "center", padding: S.xl },
  confirmDismiss: { position: "absolute", inset: 0 },
  confirmCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: C.bgElevated,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: S.xl,
    alignItems: "center",
  },
  confirmIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.errorDim, alignItems: "center", justifyContent: "center", marginBottom: S.md },
  confirmTitle: { color: C.text, fontSize: 16, fontWeight: "800", textAlign: "center" },
  confirmBody: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: S.sm },
  deleteButton: { backgroundColor: C.error, borderRadius: R.md, paddingVertical: 12, alignItems: "center", justifyContent: "center", width: "100%", marginTop: S.lg },
  deleteButtonText: { color: C.white, fontSize: 13, fontWeight: "800" },
  cancelButton: { paddingVertical: 11, alignItems: "center", width: "100%", marginTop: 4 },
  cancelButtonText: { color: C.muted, fontSize: 13, fontWeight: "700" },
  footerNote: { color: C.mutedDark, fontSize: 11, lineHeight: 17, marginTop: S.xl, textAlign: "center" },
});
