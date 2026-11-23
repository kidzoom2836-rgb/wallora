import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenHeader } from "../components/ui/ScreenHeader";
import { apiJson } from "../lib/api";
import { useAuth } from "../lib/auth";
import { C, R, S } from "../lib/theme";

type Category = { slug: string; name: string; wallpaperCount?: number };

type ImportItem = {
  id: number;
  slug: string;
  status: "imported" | "skipped" | "failed";
  reason?: string;
};

type ImportResult = {
  dryRun: boolean;
  category: string;
  query: string;
  fetched: number;
  imported?: number;
  skipped?: number;
  failed?: number;
  results?: ImportItem[];
  hits?: { id: number; title: string; creator: string; pageUrl?: string }[];
};

export default function AdminScreen() {
  const { user, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState("nature");
  const [query, setQuery] = useState("");
  const [perPage, setPerPage] = useState("10");
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    apiJson<Category[]>("/api/v1/categories")
      .then((items) => {
        setCategories(items ?? []);
        if (items?.length && !items.some((item) => item.slug === "nature")) {
          setCategory(items[0].slug);
        }
      })
      .catch(() => setCategories([]));
  }, []);

  const runImport = useCallback(async () => {
    const limit = Math.min(20, Math.max(1, Number.parseInt(perPage, 10) || 10));
    setBusy(true);
    setNotice(null);
    setResult(null);
    try {
      const data = await apiJson<ImportResult>("/api/v1/admin/wallpapers/import/pixabay", {
        method: "POST",
        body: JSON.stringify({
          categorySlug: category,
          query: query.trim() || undefined,
          perPage: limit,
          dryRun,
        }),
      });
      setResult(data);
    } catch (e: any) {
      setNotice(e?.message ?? "Could not run the import.");
    } finally {
      setBusy(false);
    }
  }, [category, dryRun, perPage, query]);

  /** Backfill every seeded category with a small, timeout-friendly batch. */
  const runAllCategories = useCallback(async () => {
    const limit = Math.min(5, Math.max(1, Number.parseInt(perPage, 10) || 5));
    setBusy(true);
    setNotice(null);
    setResult(null);
    const all: ImportItem[] = [];
    let fetched = 0;
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    try {
      for (const item of categories) {
        const data = await apiJson<ImportResult>("/api/v1/admin/wallpapers/import/pixabay", {
          method: "POST",
          body: JSON.stringify({
            categorySlug: item.slug,
            perPage: limit,
            dryRun: false,
          }),
        });
        fetched += data.fetched ?? 0;
        imported += data.imported ?? 0;
        skipped += data.skipped ?? 0;
        failed += data.failed ?? 0;
        all.push(...(data.results ?? []));
      }
      setResult({
        dryRun: false,
        category: "all",
        query: `${limit} per category`,
        fetched,
        imported,
        skipped,
        failed,
        results: all,
      });
    } catch (e: any) {
      setNotice(e?.message ?? "Could not complete the bulk import.");
    } finally {
      setBusy(false);
    }
  }, [categories, perPage]);

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  if (user?.role !== "super_admin") {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Admin" subtitle="WALLORA control room" />
        <View style={styles.state}>
          <Ionicons name="lock-closed-outline" size={42} color={C.muted} />
          <Text style={styles.stateTitle}>Admins only</Text>
          <Text style={styles.stateText}>
            Sign in with a WALLORA super-admin account to import categorized wallpapers.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Admin imports"
        subtitle="Bring Pixabay photos into the WALLORA account"
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="images-outline" size={24} color={C.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Discover wallpaper library</Text>
            <Text style={styles.heroText}>
              Photos are attributed to Pixabay and published under the verified @wallora account.
              Each import is cached for 24 hours.
            </Text>
          </View>
        </View>

        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {categories.map((item) => (
            <Pressable
              key={item.slug}
              onPress={() => {
                setCategory(item.slug);
                setResult(null);
              }}
              style={[styles.chip, category === item.slug && styles.chipActive]}
            >
              <Text style={[styles.chipText, category === item.slug && styles.chipTextActive]}>
                {item.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Search phrase (optional)</Text>
        <TextInput
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setResult(null);
          }}
          placeholder="Leave blank to use the category default"
          placeholderTextColor={C.muted}
          style={styles.input}
        />

        <Text style={styles.label}>Photos per import</Text>
        <TextInput
          value={perPage}
          onChangeText={setPerPage}
          keyboardType="number-pad"
          placeholder="10"
          placeholderTextColor={C.muted}
          style={styles.input}
        />
        <Text style={styles.hint}>Minimum 1, maximum 20. Each photo keeps its Pixabay credit.</Text>

        <Pressable style={styles.switchRow} onPress={() => setDryRun((value) => !value)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>Preview only</Text>
            <Text style={styles.hint}>Preview hits without writing wallpapers to the database.</Text>
          </View>
          <Switch
            value={dryRun}
            onValueChange={setDryRun}
            trackColor={{ false: C.border, true: C.accent }}
            thumbColor={C.white}
          />
        </Pressable>

        {notice ? <Text style={styles.error}>{notice}</Text> : null}

        <Pressable
          onPress={() => void runImport()}
          disabled={busy || !category}
          style={[styles.button, busy && styles.buttonBusy]}
        >
          {busy ? (
            <ActivityIndicator color={C.bg} size="small" />
          ) : (
            <>
              <Ionicons name="cloud-download-outline" size={17} color={C.bg} />
              <Text style={styles.buttonText}>
                {dryRun ? "Preview Pixabay hits" : "Import into Discover"}
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={() => void runAllCategories()}
          disabled={busy || !categories.length}
          style={[styles.buttonSecondary, busy && styles.buttonBusy]}
        >
          <Ionicons name="grid-outline" size={16} color={C.accent} />
          <Text style={styles.buttonSecondaryText}>Import all categories ({categories.length})</Text>
        </Pressable>
        <Text style={styles.hint}>Bulk mode imports up to 5 photos per category per run.</Text>

        {result ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>
              {result.dryRun ? "Preview ready" : "Import complete"}
            </Text>
            <Text style={styles.resultMeta}>Category: {result.category}</Text>
            <Text style={styles.resultMeta}>Search: {result.query}</Text>
            <Text style={styles.resultMeta}>Fetched: {result.fetched}</Text>
            {!result.dryRun ? (
              <View style={styles.summaryRow}>
                <Text style={[styles.summary, { color: C.success }]}>Imported {result.imported ?? 0}</Text>
                <Text style={[styles.summary, { color: C.muted }]}>Skipped {result.skipped ?? 0}</Text>
                <Text style={[styles.summary, { color: C.error }]}>Failed {result.failed ?? 0}</Text>
              </View>
            ) : null}

            {(result.hits ?? []).map((hit) => (
              <Text key={hit.id} style={styles.resultLine}>
                • {hit.title} — {hit.creator}
              </Text>
            ))}
            {(result.results ?? []).map((item) => (
              <Text key={item.id} style={styles.resultLine}>
                • {item.status}: {item.slug}
                {item.reason ? ` — ${item.reason}` : ""}
              </Text>
            ))}
            {!result.dryRun ? (
              <Text style={styles.hint}>Open Discover and search @wallora to see the new photos.</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  content: { padding: S.lg, paddingBottom: 48, gap: 6 },
  hero: {
    flexDirection: "row",
    gap: 12,
    padding: S.md,
    borderRadius: R.md,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: S.md,
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: R.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentDim,
  },
  heroTitle: { color: C.text, fontSize: 15, fontWeight: "800" },
  heroText: { color: C.textSoft, fontSize: 12, lineHeight: 18, marginTop: 4 },
  label: { color: C.text, fontSize: 12, fontWeight: "800", marginTop: 12, marginBottom: 7 },
  chips: { marginHorizontal: -S.lg, paddingHorizontal: S.lg },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: R.pill,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.textSoft, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: C.bg },
  input: {
    minHeight: 44,
    borderRadius: R.md,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    color: C.text,
    fontSize: 13,
  },
  hint: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    marginTop: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.borderSoft,
  },
  switchTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
    minHeight: 46,
    borderRadius: R.md,
    backgroundColor: C.accent,
  },
  buttonBusy: { opacity: 0.7 },
  buttonText: { color: C.bg, fontSize: 13, fontWeight: "900" },
  buttonSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    minHeight: 44,
    borderRadius: R.md,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.accent + "66",
  },
  buttonSecondaryText: { color: C.accent, fontSize: 12, fontWeight: "800" },
  error: { color: C.error, fontSize: 12, marginTop: 12 },
  resultCard: {
    marginTop: 20,
    padding: S.md,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  resultTitle: { color: C.text, fontSize: 15, fontWeight: "900", marginBottom: 6 },
  resultMeta: { color: C.textSoft, fontSize: 12 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginVertical: 8 },
  summary: { fontSize: 12, fontWeight: "800" },
  resultLine: { color: C.textSoft, fontSize: 11, lineHeight: 17 },
  state: { flex: 1, alignItems: "center", justifyContent: "center", padding: S.xl, gap: 8 },
  stateTitle: { color: C.text, fontSize: 18, fontWeight: "800", marginTop: 8 },
  stateText: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
