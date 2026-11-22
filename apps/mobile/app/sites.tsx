import { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenHeader } from "../components/ui/ScreenHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { apiJson } from "../lib/api";
import { API_BASE } from "../lib/config";
import { useAuth } from "../lib/auth";
import { C, R } from "../lib/theme";

type Site = {
  id: string;
  slug: string;
  title?: string | null;
  prompt?: string | null;
  published?: boolean;
  externalPublished?: boolean;
  forSale?: boolean;
  priceCents?: number;
  createdAt?: string;
};

function dateLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function priceLabel(cents?: number) {
  return typeof cents === "number" && cents > 0 ? `$${(cents / 100).toFixed(2)}` : "Free to view";
}

export default function SitesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [publicSites, setPublicSites] = useState<Site[]>([]);
  const [ownedSites, setOwnedSites] = useState<Site[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [loadingOwned, setLoadingOwned] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorPublic, setErrorPublic] = useState<string | null>(null);
  const [errorOwned, setErrorOwned] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorPublic(null);
    setErrorOwned(null);
    setLoadingPublic(true);
    setLoadingOwned(!!user);

    const publicResult = await apiJson<{ sites: Site[] }>("/api/v1/sites/public")
      .then((data) => ({ ok: true as const, sites: Array.isArray(data?.sites) ? data.sites : [] }))
      .catch((e: any) => ({ ok: false as const, message: e?.message ?? "Could not load public sites." }));

    if (publicResult.ok) {
      setPublicSites(publicResult.sites);
    } else {
      setPublicSites([]);
      setErrorPublic(publicResult.message);
    }
    setLoadingPublic(false);

    if (!user) {
      setOwnedSites([]);
      setLoadingOwned(false);
      return;
    }

    const ownedResult = await apiJson<{ sites: Site[] }>("/api/v1/sites")
      .then((data) => ({ ok: true as const, sites: Array.isArray(data?.sites) ? data.sites : [] }))
      .catch((e: any) => ({ ok: false as const, message: e?.message ?? "Could not load your sites." }));

    if (ownedResult.ok) {
      setOwnedSites(ownedResult.sites);
    } else {
      setOwnedSites([]);
      setErrorOwned(ownedResult.message);
    }
    setLoadingOwned(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openSite = async (slug: string) => {
    try {
      await Linking.openURL(`${API_BASE}/sites/${slug}`);
    } catch {
      Alert.alert("Could not open site", "Check your connection and try again.");
    }
  };

  const renderSite = (item: Site, owned = false) => (
    <Pressable
      key={item.id}
      onPress={() => {
        if (owned && !item.published && !item.externalPublished) {
          router.push({ pathname: "/builder", params: { site: item.id } });
          return;
        }
        void openSite(item.slug);
      }}
      style={({ pressed }) => [styles.siteCard, pressed && styles.pressed]}
    >
      <View style={styles.siteTop}>
        <View style={styles.siteIcon}>
          <Ionicons name="globe-outline" size={18} color={C.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.siteTitle} numberOfLines={2}>
            {item.title || item.slug}
          </Text>
          <Text style={styles.siteSlug} numberOfLines={1}>
            /sites/{item.slug}
          </Text>
        </View>
        <Ionicons name="open-outline" size={16} color={C.muted} />
      </View>

      {item.prompt ? (
        <Text style={styles.sitePrompt} numberOfLines={3}>
          {item.prompt}
        </Text>
      ) : null}

      <View style={styles.siteMeta}>
        <View style={styles.metaItem}>
          <Ionicons
            name={item.forSale ? "pricetag-outline" : "checkmark-circle-outline"}
            size={12}
            color={item.forSale ? C.gold : C.success}
          />
          <Text style={[styles.metaText, { color: item.forSale ? C.gold : C.success }]}>
            {priceLabel(item.priceCents)}
          </Text>
        </View>
        <Text style={styles.metaText}>{dateLabel(item.createdAt)}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Sites"
        subtitle="Projects built on WALLORA"
        right={
          <Pressable onPress={() => router.push("/builder")} hitSlop={10}>
            <Ionicons name="code-slash-outline" size={21} color={C.accent} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="globe-outline" size={28} color={C.accent} />
          </View>
          <Text style={styles.heroTitle}>Explore what the Builder made</Text>
          <Text style={styles.heroCopy}>
            Published WALLORA sites are live here. Open one to see the full working project.
          </Text>
          <Pressable onPress={() => router.push("/builder")} style={styles.builderButton}>
            <Ionicons name="sparkles-outline" size={16} color={C.bg} />
            <Text style={styles.builderButtonText}>Build your own site</Text>
          </Pressable>
        </View>

        {user ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your sites</Text>
            {loadingOwned ? (
              <LoadingState label="Loading your sites…" />
            ) : errorOwned ? (
              <ErrorState message={errorOwned} onRetry={() => void load()} />
            ) : ownedSites.length ? (
              ownedSites.map((site) => renderSite(site, true))
            ) : (
              <EmptyState
                icon="code-slash-outline"
                title="No sites yet"
                message="Create your first project in the WALLORA Builder."
                actionLabel="Open Builder"
                onAction={() => router.push("/builder")}
              />
            )}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Published projects</Text>
          {loadingPublic ? (
            <LoadingState label="Loading public sites…" />
          ) : errorPublic ? (
            <ErrorState message={errorPublic} onRetry={() => void load()} />
          ) : publicSites.length ? (
            publicSites.map((site) => renderSite(site))
          ) : (
            <EmptyState
              icon="globe-outline"
              title="No public sites yet"
              message="Sites published from the Builder will appear here."
              actionLabel="Open Builder"
              onAction={() => router.push("/builder")}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  hero: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: 18,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: R.md,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroTitle: { color: C.text, fontSize: 18, fontWeight: "800" },
  heroCopy: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  builderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: C.accent,
    borderRadius: R.md,
    paddingVertical: 12,
    marginTop: 16,
  },
  builderButtonText: { color: C.bg, fontSize: 13, fontWeight: "800" },
  section: { marginTop: 28 },
  sectionTitle: {
    color: C.text,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  siteCard: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: 14,
    marginBottom: 10,
  },
  pressed: { opacity: 0.75 },
  siteTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  siteIcon: {
    width: 36,
    height: 36,
    borderRadius: R.sm,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  siteTitle: { color: C.text, fontSize: 14, fontWeight: "700" },
  siteSlug: { color: C.muted, fontSize: 11, marginTop: 2 },
  sitePrompt: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 12 },
  siteMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: C.muted, fontSize: 11 },
});
