import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Linking,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenHeader } from "../components/ui/ScreenHeader";
import { apiJson } from "../lib/api";
import { API_BASE } from "../lib/config";
import { C, R, S } from "../lib/theme";

type PublicSite = {
  id: string;
  slug: string;
  title?: string | null;
  prompt?: string | null;
  forSale?: boolean;
  priceCents?: number;
  createdAt?: string;
};

type PublicSites = { sites: PublicSite[] };

function dateLabel(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function BuilderScreen() {
  const [sites, setSites] = useState<PublicSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiJson<PublicSites>("/api/v1/sites/public");
      setSites(Array.isArray(data?.sites) ? data.sites : []);
    } catch (e: any) {
      setError(e?.message ?? "Could not load public sites.");
      setSites([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openUrl = async (url: string, failure: string) => {
    setOpenError(null);
    try {
      await Linking.openURL(url);
    } catch {
      setOpenError(failure);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Builder"
        subtitle="Real sites built on WALLORA"
        right={
          <Pressable
            onPress={() => void load()}
            hitSlop={10}
            style={styles.refreshButton}
          >
            <Ionicons name="refresh-outline" size={19} color={C.accent} />
          </Pressable>
        }
      />
      <FlatList
        data={sites}
        keyExtractor={(item) => item.id ?? item.slug}
        contentContainerStyle={styles.list}
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
        ListHeaderComponent={
          <View style={styles.intro}>
            <View style={styles.introTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>WALLORA BUILDER</Text>
                <Text style={styles.title}>Build once, publish anywhere</Text>
              </View>
              <View style={styles.mark}>
                <Ionicons name="code-slash-outline" size={22} color={C.accent} />
              </View>
            </View>
            <Text style={styles.subtitle}>
              These are real, public website projects from WALLORA accounts. Open any one of them in your browser.
            </Text>

            <View style={styles.builderPanel}>
              <View style={styles.panelIcon}>
                <Ionicons name="color-wand-outline" size={21} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.panelTitle}>Generate a new site on the web</Text>
                <Text style={styles.panelText}>
                  Authenticated site generation happens in the official WALLORA web builder. It is not faked in this app.
                </Text>
              </View>
              <Pressable
                onPress={() => void openUrl(`${API_BASE}/builder`, "Could not open the WALLORA web builder.")}
                style={styles.panelButton}
              >
                <Text style={styles.panelButtonText}>Open builder</Text>
                <Ionicons name="open-outline" size={13} color={C.bg} />
              </Pressable>
            </View>

            {openError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={C.error} />
                <Text style={styles.errorText}>{openError}</Text>
              </View>
            ) : null}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={C.error} />
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => void load()}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>PUBLIC PROJECTS</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.state}>
              <ActivityIndicator color={C.accent} size="large" />
              <Text style={styles.stateText}>Loading public sites…</Text>
            </View>
          ) : !error ? (
            <View style={styles.state}>
              <Ionicons name="globe-outline" size={42} color={C.muted} />
              <Text style={styles.stateText}>No public sites published yet</Text>
              <Text style={styles.stateSub}>
                Sites published from the WALLORA web builder will appear here with their live links.
              </Text>
              <Pressable
                style={styles.primaryButton}
                onPress={() => void openUrl(`${API_BASE}/builder`, "Could not open the WALLORA web builder.")}
              >
                <Text style={styles.primaryButtonText}>Open web builder</Text>
              </Pressable>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <View style={styles.siteCard}>
            <View style={styles.siteTop}>
              <View style={styles.siteIcon}>
                <Ionicons name="globe-outline" size={18} color={C.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.siteTitle} numberOfLines={2}>
                  {item.title ?? item.slug}
                </Text>
                <Text style={styles.siteSlug} numberOfLines={1}>
                  /sites/{item.slug}
                </Text>
              </View>
            </View>

            {item.prompt ? (
              <Text style={styles.sitePrompt} numberOfLines={3}>
                {item.prompt}
              </Text>
            ) : null}

            <View style={styles.siteMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={12} color={C.muted} />
                <Text style={styles.metaText}>{dateLabel(item.createdAt) || "Published"}</Text>
              </View>
              {item.forSale ? (
                <View style={styles.metaItem}>
                  <Ionicons name="pricetag-outline" size={12} color={C.gold} />
                  <Text style={[styles.metaText, { color: C.gold }]}>
                    {item.priceCents ? `$${(item.priceCents / 100).toFixed(2)}` : "Free"}
                  </Text>
                </View>
              ) : (
                <View style={styles.metaItem}>
                  <Ionicons name="checkmark-circle-outline" size={12} color={C.success} />
                  <Text style={[styles.metaText, { color: C.success }]}>Public</Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={() => void openUrl(`${API_BASE}/sites/${item.slug}`, "Could not open this site in your browser.")}
              style={styles.openButton}
            >
              <Ionicons name="open-outline" size={15} color={C.bg} />
              <Text style={styles.openButtonText}>Open public site</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: R.md,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { paddingHorizontal: S.lg, paddingBottom: S.xxxl },
  intro: { paddingTop: S.lg },
  introTop: { flexDirection: "row", alignItems: "center", gap: S.md },
  eyebrow: { fontSize: 10, letterSpacing: 1.6, color: C.accent, fontWeight: "800", marginBottom: 4 },
  title: { fontSize: 25, fontWeight: "800", color: C.text },
  subtitle: { fontSize: 12, color: C.muted, marginTop: S.sm, lineHeight: 18 },
  mark: {
    width: 44,
    height: 44,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  builderPanel: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: S.sm,
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accent + "44",
    borderRadius: R.lg,
    padding: S.md,
    marginTop: S.lg,
  },
  panelIcon: {
    width: 38,
    height: 38,
    borderRadius: R.md,
    backgroundColor: C.bgDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  panelTitle: { fontSize: 14, fontWeight: "800", color: C.text },
  panelText: { fontSize: 11, color: C.textSoft, lineHeight: 17, marginTop: 3 },
  panelButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.accent,
    borderRadius: R.md,
    paddingVertical: 10,
    marginTop: S.xs,
  },
  panelButtonText: { color: C.bg, fontSize: 12, fontWeight: "800" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: S.sm,
    backgroundColor: C.errorDim,
    borderWidth: 1,
    borderColor: C.error + "55",
    borderRadius: R.md,
    padding: S.md,
    marginTop: S.md,
  },
  errorText: { flex: 1, color: C.error, fontSize: 12 },
  retryText: { color: C.accent, fontSize: 12, fontWeight: "800" },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: "800",
    color: C.accent,
    marginTop: S.xl,
    marginBottom: S.sm,
  },
  siteCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: S.md,
    marginBottom: S.md,
  },
  siteTop: { flexDirection: "row", alignItems: "center", gap: S.sm },
  siteIcon: {
    width: 38,
    height: 38,
    borderRadius: R.md,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  siteTitle: { fontSize: 15, fontWeight: "800", color: C.text },
  siteSlug: { fontSize: 11, color: C.accent, marginTop: 2 },
  sitePrompt: { fontSize: 12, color: C.textSoft, lineHeight: 18, marginTop: S.md },
  siteMeta: { flexDirection: "row", gap: S.lg, marginTop: S.md },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 11, color: C.muted },
  openButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: C.accent,
    borderRadius: R.md,
    paddingVertical: 11,
    marginTop: S.md,
  },
  openButtonText: { fontSize: 12, fontWeight: "800", color: C.bg },
  state: { alignItems: "center", paddingVertical: 64, gap: S.sm },
  stateText: { fontSize: 15, fontWeight: "700", color: C.text, textAlign: "center", marginTop: 6 },
  stateSub: { fontSize: 12, color: C.muted, textAlign: "center", paddingHorizontal: S.xl, lineHeight: 18 },
  primaryButton: { backgroundColor: C.accent, borderRadius: R.md, paddingHorizontal: S.xl, paddingVertical: 11, marginTop: S.sm },
  primaryButtonText: { color: C.bg, fontWeight: "800", fontSize: 13 },
});
