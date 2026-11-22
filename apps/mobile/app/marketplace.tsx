import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ScreenHeader } from "../components/ui/ScreenHeader";
import { apiJson } from "../lib/api";
import { assetUrl } from "../lib/config";
import { C, R, S } from "../lib/theme";

type Product = {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  license?: string | null;
  coverUrl?: string | null;
  createdAt?: string;
  purchaseCount?: number;
  owned?: boolean;
  creator?: {
    id?: string;
    username?: string;
    displayName?: string;
    verified?: boolean;
    avatarUrl?: string | null;
    tier?: string | null;
  } | null;
};

type Pagination = { page?: number; limit?: number; total?: number; totalPages?: number };
type ProductList = { items: Product[]; pagination: Pagination };

const PAGE_SIZE = 12;
const LICENSES = ["all", "Personal", "Commercial", "Extended"] as const;
const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "popular", label: "Popular" },
  { id: "price-asc", label: "Price: low" },
  { id: "price-desc", label: "Price: high" },
] as const;

function priceLabel(cents: number | undefined) {
  const value = typeof cents === "number" ? cents : 0;
  if (value === 0) return "Free";
  return `$${(value / 100).toFixed(2)}`;
}

export default function MarketplaceScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [license, setLicense] = useState<(typeof LICENSES)[number]>("all");
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("newest");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      setError(null);
      if (nextPage > 1) setLoadingMore(true);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: String(PAGE_SIZE),
          sort,
        });
        if (search) params.set("q", search);
        if (license !== "all") params.set("license", license);
        const data = await apiJson<ProductList>(`/api/v1/products?${params.toString()}`);
        const items = Array.isArray(data?.items) ? data.items : [];
        setProducts((prev) => (replace ? items : [...prev, ...items]));
        setTotal(data?.pagination?.total ?? 0);
        setPage(data?.pagination?.page ?? nextPage);
        setTotalPages(data?.pagination?.totalPages ?? 1);
      } catch (e: any) {
        setError(e?.message ?? "Could not load marketplace listings.");
        if (replace) setProducts([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [license, search, sort],
  );

  useEffect(() => {
    setLoading(true);
    void load(1, true);
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load(1, true);
  }, [load]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Marketplace"
        subtitle="Real listings from WALLORA creators"
        right={
          <Pressable onPress={onRefresh} hitSlop={10} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={19} color={C.accent} />
          </Pressable>
        }
      />
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text style={styles.eyebrow}>MARKETPLACE</Text>
            <Text style={styles.title}>Premium packs</Text>
            <Text style={styles.subtitle}>
              {total ? `${total} real listings` : "Real listings with clear licenses and honest purchase counts"}
            </Text>

            <View style={styles.search}>
              <Ionicons name="search-outline" size={17} color={C.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search packs, creators, licenses…"
                placeholderTextColor={C.muted}
                style={styles.searchInput}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={C.muted} />
                </Pressable>
              )}
            </View>

            <View style={styles.filterLabel}>
              <Ionicons name="filter-outline" size={13} color={C.muted} />
              <Text style={styles.filterLabelText}>LICENSE</Text>
            </View>
            <View style={styles.chipRow}>
              {LICENSES.map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setLicense(value)}
                  style={[styles.chip, license === value && styles.chipActive]}
                >
                  <Text style={[styles.chipText, license === value && styles.chipTextActive]}>
                    {value === "all" ? "All" : value}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.filterLabel}>
              <Ionicons name="swap-vertical-outline" size={13} color={C.muted} />
              <Text style={styles.filterLabelText}>SORT BY API</Text>
            </View>
            <View style={styles.chipRow}>
              {SORTS.map((value) => (
                <Pressable
                  key={value.id}
                  onPress={() => setSort(value.id)}
                  style={[styles.chip, sort === value.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, sort === value.id && styles.chipTextActive]}>{value.label}</Text>
                </Pressable>
              ))}
            </View>
            {error && products.length === 0 ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.state}>
              <ActivityIndicator color={C.accent} size="large" />
              <Text style={styles.stateText}>Loading listings…</Text>
            </View>
          ) : (
            <View style={styles.state}>
              <Ionicons name="cart-outline" size={42} color={C.muted} />
              <Text style={styles.stateText}>{error ? "Couldn’t load the marketplace" : "No listings found"}</Text>
              <Text style={styles.stateSub}>
                {error ?? (search || license !== "all" ? "Try clearing your filters." : "Products appear here once creators publish them.")}
              </Text>
              <Pressable style={styles.primaryButton} onPress={onRefresh}>
                <Text style={styles.primaryButtonText}>Try again</Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          products.length > 0 ? (
            <View style={styles.footer}>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {page < totalPages ? (
                <Pressable
                  onPress={() => void load(page + 1, false)}
                  disabled={loadingMore}
                  style={[styles.secondaryButton, loadingMore && styles.buttonDisabled]}
                >
                  {loadingMore ? (
                    <ActivityIndicator color={C.accent} size="small" />
                  ) : (
                    <Text style={styles.secondaryButtonText}>Load more products</Text>
                  )}
                </Pressable>
              ) : (
                <Text style={styles.endText}>All listings loaded</Text>
              )}
            </View>
          ) : undefined
        }
        renderItem={({ item }) => {
          const cover = assetUrl(item.coverUrl);
          return (
            <Pressable
              onPress={() => router.push({ pathname: "/marketplace/[id]", params: { id: item.id } })}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={styles.imageWrap}>
                {cover ? (
                  <Image source={{ uri: cover }} style={styles.image} resizeMode="cover" />
                ) : (
                  <View style={styles.imageFallback}>
                    <Ionicons name="image-outline" size={28} color={C.mutedDark} />
                  </View>
                )}
                {item.license ? (
                  <View style={styles.licenseBadge}>
                    <Text style={styles.licenseText} numberOfLines={1}>
                      {item.license}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.creator} numberOfLines={1}>
                  {item.creator?.displayName ?? item.creator?.username ?? "WALLORA creator"}
                </Text>
                <View style={styles.cardFooter}>
                  <Text style={[styles.price, item.price === 0 && styles.priceFree]}>{priceLabel(item.price)}</Text>
                  <View style={styles.purchaseStat}>
                    <Ionicons name="bag-outline" size={12} color={C.muted} />
                    <Text style={styles.purchaseText}>{item.purchaseCount ?? 0}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
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
  eyebrow: { fontSize: 10, letterSpacing: 1.6, color: C.accent, fontWeight: "800", marginBottom: 4 },
  title: { fontSize: 26, fontWeight: "800", color: C.text },
  subtitle: { fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 18 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: 11,
    marginTop: S.lg,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 14, paddingVertical: 0 },
  filterLabel: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: S.md, marginBottom: S.sm },
  filterLabelText: { fontSize: 10, letterSpacing: 1.2, color: C.muted, fontWeight: "800" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: S.sm },
  chip: {
    paddingHorizontal: S.md,
    paddingVertical: 7,
    borderRadius: R.pill,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { fontSize: 12, fontWeight: "700", color: C.muted },
  chipTextActive: { color: C.bg },
  error: { color: C.error, fontSize: 12, marginTop: S.sm },
  gridRow: { gap: S.sm, marginBottom: S.sm },
  card: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    overflow: "hidden",
  },
  cardPressed: { opacity: 0.8 },
  imageWrap: { width: "100%", aspectRatio: 0.83, backgroundColor: C.raised },
  image: { width: "100%", height: "100%" },
  imageFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  licenseBadge: {
    position: "absolute",
    top: S.xs,
    left: S.xs,
    maxWidth: "90%",
    backgroundColor: "rgba(11,12,15,0.82)",
    borderRadius: R.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  licenseText: { color: C.accent, fontSize: 9, fontWeight: "800" },
  cardBody: { padding: S.sm },
  cardTitle: { fontSize: 13, fontWeight: "800", color: C.text, minHeight: 34 },
  creator: { fontSize: 11, color: C.muted, marginTop: 3 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: S.sm },
  price: { fontSize: 15, fontWeight: "800", color: C.accent },
  priceFree: { color: C.success },
  purchaseStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  purchaseText: { fontSize: 11, color: C.muted },
  state: { alignItems: "center", paddingVertical: 64, gap: S.sm },
  stateText: { fontSize: 15, fontWeight: "700", color: C.text, textAlign: "center", marginTop: 6 },
  stateSub: { fontSize: 12, color: C.muted, textAlign: "center", paddingHorizontal: S.xl, lineHeight: 18 },
  primaryButton: { backgroundColor: C.accent, borderRadius: R.md, paddingHorizontal: S.xl, paddingVertical: 11, marginTop: S.sm },
  primaryButtonText: { color: C.bg, fontWeight: "800", fontSize: 13 },
  secondaryButton: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  secondaryButtonText: { color: C.accent, fontWeight: "700", fontSize: 13 },
  buttonDisabled: { opacity: 0.6 },
  footer: { paddingVertical: S.lg },
  endText: { textAlign: "center", color: C.mutedDark, fontSize: 11 },
});
