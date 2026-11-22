import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
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

type Tier = "verified" | "premium" | "supreme";

type VerificationRequest = {
  status?: string | null;
  note?: string | null;
  createdAt?: string;
  tier?: string;
};

type VerificationInfo = {
  tier?: string;
  claimed?: boolean;
  request?: VerificationRequest | null;
  limits?: Record<string, unknown> | unknown[];
  perks?: Record<string, unknown> | unknown[];
};

type VerificationState = { tier?: string; claimed?: boolean };

type Entry = { label: string; value: string };

function humanize(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (Array.isArray(value)) return value.map(displayValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toEntries(value: VerificationInfo["limits"] | undefined): Entry[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return { label: item, value: "" };
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          const label = String(obj.label ?? obj.name ?? obj.key ?? "Perk");
          const raw = obj.value ?? obj.description ?? obj.detail ?? obj.limit;
          return { label, value: raw === undefined ? "" : displayValue(raw) };
        }
        return { label: displayValue(item), value: "" };
      })
      .slice(0, 12);
  }
  return Object.entries(value)
    .slice(0, 12)
    .map(([key, raw]) => ({ label: humanize(key), value: displayValue(raw) }));
}

function Banner({ message, tone }: { message: string; tone: "success" | "error" | "info" }) {
  const color = tone === "success" ? C.success : tone === "error" ? C.error : C.blue;
  const icon =
    tone === "success" ? "checkmark-circle-outline" : tone === "error" ? "alert-circle-outline" : "information-circle-outline";
  return (
    <View style={[styles.banner, { borderColor: color + "55" }]}>
      <Ionicons name={icon} size={17} color={color} />
      <Text style={[styles.bannerText, { color }]}>{message}</Text>
    </View>
  );
}

export default function VerificationScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [info, setInfo] = useState<VerificationInfo | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tier, setTier] = useState<Tier>("verified");
  const [reason, setReason] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" | "info" } | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [main, state] = await Promise.all([
        apiJson<VerificationInfo>("/api/v1/verification"),
        apiJson<VerificationState>("/api/v1/verification/state").catch(() => null),
      ]);
      setInfo(main);
      setClaimed(state?.claimed ?? main?.claimed ?? false);
    } catch (e: any) {
      setError(e?.message ?? "Could not load your verification status.");
      setInfo(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const claim = async () => {
    setClaiming(true);
    setMessage(null);
    setError(null);
    try {
      await apiJson("/api/v1/verification/claim", { method: "POST" });
      setClaimed(true);
      setMessage({ text: "Your free grey tick is claimed.", tone: "success" });
    } catch (e: any) {
      setError(e?.message ?? "Could not claim your free tick.");
    } finally {
      setClaiming(false);
    }
  };

  const apply = async () => {
    const minReason = tier === "supreme" ? 40 : 20;
    const minPortfolio = tier === "supreme" ? 16 : 8;
    if (reason.trim().length < minReason) {
      setMessage({ text: `Please write at least ${minReason} characters about your work.`, tone: "error" });
      return;
    }
    if (portfolio.trim().length < minPortfolio) {
      setMessage({ text: `Please add a portfolio or profile link (at least ${minPortfolio} characters).`, tone: "error" });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      await apiJson("/api/v1/verification", {
        method: "POST",
        body: JSON.stringify({ tier, reason: reason.trim(), portfolio: portfolio.trim() }),
      });
      setMessage({ text: "Application submitted for review.", tone: "success" });
      setReason("");
      setPortfolio("");
      await load();
    } catch (e: any) {
      setMessage({ text: e?.message ?? "Could not submit your application.", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const currentTier = info?.tier ?? "free";
  const meta = tierMeta(currentTier);
  const limits = toEntries(info?.limits);
  const perks = toEntries(info?.perks);
  const request = info?.request ?? null;

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
        <ScreenHeader title="Verification" subtitle="Authenticity on WALLORA" />
        <View style={styles.center}>
          <Ionicons name="shield-checkmark-outline" size={46} color={C.accent} />
          <Text style={styles.stateTitle}>Sign in to see your verification</Text>
          <Text style={styles.stateSub}>
            WALLORA verification is tied to your account. Sign in to see your tier, claim your free grey tick and apply for review.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.push("/auth/login")}>
            <Text style={styles.primaryButtonText}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="Verification" subtitle="Authenticity on WALLORA" />
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
        <View style={styles.intro}>
          <Ionicons name="shield-checkmark-outline" size={22} color={C.accent} />
          <Text style={styles.introText}>
            Verification confirms that people, posts and creators on WALLORA are who they say they are. Every account gets a
            free grey tick; blue, gold and violet badges are reviewed by WALLORA admins and cannot be self-issued.
          </Text>
        </View>

        {message ? <Banner message={message.text} tone={message.tone} /> : null}
        {error ? <Banner message={error} tone="error" /> : null}

        {loading ? (
          <View style={styles.inlineState}>
            <ActivityIndicator color={C.accent} size="small" />
            <Text style={styles.stateText}>Loading your verification…</Text>
          </View>
        ) : null}

        {info ? (
          <>
            <View style={styles.tierCard}>
              <View style={styles.tierTop}>
                <VerifiedBadge tier={currentTier} size="lg" />
                <Text style={styles.tierLabel}>{meta.label}</Text>
              </View>
              <View style={styles.tierRow}>
                <Ionicons
                  name={claimed ? "checkmark-circle" : "ellipse-outline"}
                  size={16}
                  color={claimed ? C.success : C.muted}
                />
                <Text style={[styles.tierRowText, claimed && { color: C.success }]}>
                  {claimed ? "Free grey tick claimed" : "Free grey tick not claimed yet"}
                </Text>
              </View>
              {request?.status ? (
                <View style={styles.tierRow}>
                  <Ionicons
                    name={request.status === "approved" ? "checkmark-circle" : request.status === "rejected" ? "close-circle" : "time-outline"}
                    size={16}
                    color={request.status === "approved" ? C.success : request.status === "rejected" ? C.error : C.accent}
                  />
                  <Text style={styles.tierRowText}>
                    Application {request.status}
                    {request.createdAt ? ` · ${new Date(request.createdAt).toLocaleDateString()}` : ""}
                  </Text>
                </View>
              ) : null}
              {request?.note ? <Text style={styles.requestNote}>{request.note}</Text> : null}

              {!claimed ? (
                <Pressable
                  onPress={() => void claim()}
                  disabled={claiming}
                  style={[styles.primaryButton, claiming && styles.buttonDisabled]}
                >
                  {claiming ? (
                    <ActivityIndicator color={C.bg} size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Claim free tick</Text>
                  )}
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.sectionLabel}>LIMITS</Text>
            <View style={styles.infoCard}>
              {limits.length ? (
                limits.map((entry) => (
                  <View key={entry.label} style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{entry.label}</Text>
                    <Text style={styles.infoValue}>{entry.value || "—"}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.infoEmpty}>No tier-specific limits are published by the API for this account.</Text>
              )}
            </View>

            <Text style={styles.sectionLabel}>PERKS</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Badge</Text>
                <Text style={styles.infoValue}>{meta.label}</Text>
              </View>
              {perks.length ? (
                perks.map((entry) => (
                  <View key={entry.label} style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{entry.label}</Text>
                    <Text style={styles.infoValue}>{entry.value || "Included"}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.infoEmpty}>Your badge appears on your WALLORA profile and posts. Color is set by your tier.</Text>
              )}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>APPLY FOR A REVIEWED BADGE</Text>
        <Text style={styles.formIntro}>
          Share real work and a link to your portfolio or profile. Applications are reviewed manually by WALLORA.
        </Text>
        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>Requested tier</Text>
          <View style={styles.tierChips}>
            {(["verified", "premium", "supreme"] as const).map((value) => (
              <Pressable
                key={value}
                onPress={() => setTier(value)}
                style={[styles.tierChip, tier === value && styles.tierChipActive]}
              >
                <VerifiedBadge tier={value} size="sm" showLabel={false} />
                <Text style={[styles.tierChipText, tier === value && styles.tierChipTextActive]}>
                  {tierMeta(value).short}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Why should you be verified?</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="What do you create, how long have you created it, and why does the badge matter?"
            placeholderTextColor={C.muted}
            style={[styles.input, styles.textArea]}
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />

          <Text style={styles.fieldLabel}>Portfolio or profile link</Text>
          <TextInput
            value={portfolio}
            onChangeText={setPortfolio}
            placeholder="https://… or @username on WALLORA"
            placeholderTextColor={C.muted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={500}
          />

          <Pressable
            onPress={() => void apply()}
            disabled={submitting}
            style={[styles.primaryButton, submitting && styles.buttonDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color={C.bg} size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Submit application</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footerNote}>
          Claiming the free tick is instant and automatic. Colored badges are earned through WALLORA review — no in-app
          action can grant them.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: S.xxl, gap: S.md },
  content: { padding: S.lg, paddingBottom: S.xxxl },
  intro: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: S.sm,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    padding: S.md,
    marginTop: S.lg,
  },
  introText: { flex: 1, color: C.textSoft, fontSize: 12, lineHeight: 18 },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: S.sm,
    borderWidth: 1,
    borderRadius: R.md,
    backgroundColor: C.card,
    padding: S.md,
    marginTop: S.md,
  },
  bannerText: { flex: 1, fontSize: 12, lineHeight: 18 },
  inlineState: { flexDirection: "row", alignItems: "center", gap: S.sm, paddingVertical: S.lg },
  tierCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: S.md,
    marginTop: S.lg,
  },
  tierTop: { flexDirection: "row", alignItems: "center", gap: S.sm },
  tierLabel: { fontSize: 16, fontWeight: "800", color: C.text },
  tierRow: { flexDirection: "row", alignItems: "center", gap: S.sm, marginTop: S.md },
  tierRowText: { fontSize: 12, color: C.textSoft, flex: 1 },
  requestNote: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: S.sm },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: "800",
    color: C.accent,
    marginTop: S.xl,
    marginBottom: S.sm,
  },
  infoCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    padding: S.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: S.md,
    paddingVertical: S.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSoft,
  },
  infoLabel: { flex: 1, color: C.textSoft, fontSize: 12 },
  infoValue: { color: C.accent, fontSize: 12, fontWeight: "700", textAlign: "right", maxWidth: "55%" },
  infoEmpty: { color: C.muted, fontSize: 12, lineHeight: 18 },
  formIntro: { color: C.muted, fontSize: 12, lineHeight: 18 },
  formCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: S.md,
    marginTop: S.sm,
  },
  fieldLabel: { color: C.textSoft, fontSize: 12, fontWeight: "700", marginTop: S.md, marginBottom: S.sm },
  tierChips: { flexDirection: "row", gap: S.sm },
  tierChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: R.md,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
  },
  tierChipActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  tierChipText: { fontSize: 10, fontWeight: "800", color: C.muted },
  tierChipTextActive: { color: C.accent },
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
  textArea: { minHeight: 96, lineHeight: 19 },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accent,
    borderRadius: R.md,
    paddingVertical: 13,
    marginTop: S.lg,
  },
  primaryButtonText: { color: C.bg, fontSize: 13, fontWeight: "800" },
  buttonDisabled: { opacity: 0.6 },
  stateTitle: { fontSize: 16, fontWeight: "800", color: C.text, textAlign: "center" },
  stateText: { fontSize: 12, color: C.muted, textAlign: "center" },
  stateSub: { fontSize: 12, color: C.muted, textAlign: "center", lineHeight: 18 },
  footerNote: { color: C.mutedDark, fontSize: 11, lineHeight: 17, marginTop: S.xl, textAlign: "center" },
});
