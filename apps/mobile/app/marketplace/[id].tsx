import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { VerifiedBadge } from "../../components/ui/VerifiedBadge";
import { apiJson } from "../../lib/api";
import { assetUrl } from "../../lib/config";
import { C, R, S } from "../../lib/theme";
import { useAuth } from "../../lib/auth";

type Product = {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  license?: string | null;
  coverUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  purchaseCount?: number;
  owned?: boolean;
  creator?: {
    id?: string;
    username?: string;
    displayName?: string;
    verified?: boolean;
    avatarUrl?: string | null;
    bio?: string | null;
    tier?: string | null;
  } | null;
};

type PurchaseResult = {
  alreadyOwned?: boolean;
  demo?: { note?: string; paymentProvider?: string | null };
  purchase?: { id?: string; status?: string; createdAt?: string };
};

function priceLabel(cents: number | undefined) {
  const value = typeof cents === "number" ? cents : 0;
  return value === 0 ? "Free" : `$${(value / 100).toFixed(2)}`;
}

export default function ProductDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ message: string; note: string; success: boolean } | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setError("No product was specified.");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await apiJson<Product>(`/api/v1/products/${encodeURIComponent(id)}`);
      setProduct(data);
    } catch (e: any) {
      setError(e?.message ?? "Could not load this product.");
      setProduct(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const purchase = async () => {
    if (!user) {
      setResult({
        message: "Sign in to purchase this pack.",
        note: "Your WALLORA account keeps the entitlement in your library.",
        success: false,
      });
      return;
    }
    if (!product || purchasing) return;
    setPurchasing(true);
    setResult(null);
    setError(null);
    try {
      const data = await apiJson<PurchaseResult>(
        `/api/v1/products/${encodeURIComponent(product.id)}/purchase`,
        { method: "POST" },
      );
      setResult({
        message: data?.alreadyOwned ? "Already in your library" : "Pack added to your library",
        note: data?.demo?.note ?? "Demo purchase — no payment was processed.",
        success: true,
      });
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Purchase failed.");
    } finally {
      setPurchasing(false);
    }
  };

  const cover = assetUrl(product?.coverUrl);
  const creator = product?.creator;
  const isOwnListing = !!user?.id && !!creator?.id && creator.id === user.id;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Product" subtitle={product?.title ?? "Loading product"} />
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
        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator color={C.accent} size="large" />
            <Text style={styles.stateText}>Loading product…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={C.error} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => { setLoading(true); void load(); }}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {result ? (
          <View
            style={[
              styles.resultBox,
              { borderColor: result.success ? C.success + "55" : C.accent + "55" },
            ]}
          >
            <Ionicons
              name={result.success ? "checkmark-circle-outline" : "information-circle-outline"}
              size={18}
              color={result.success ? C.success : C.blue}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.resultTitle, { color: result.success ? C.success : C.blue }]}>
                {result.message}
              </Text>
              <Text style={styles.resultNote}>{result.note}</Text>
            </View>
          </View>
        ) : null}

        {product ? (
          <>
            <View style={styles.hero}>
              {cover ? (
                <Image source={{ uri: cover }} style={styles.heroImage} resizeMode="cover" />
              ) : (
                <View style={styles.heroFallback}>
                  <Ionicons name="image-outline" size={40} color={C.mutedDark} />
                </View>
              )}
              {product.license ? (
                <View style={styles.licenseBadge}>
                  <Text style={styles.licenseText}>{product.license}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.titleRow}>
              <Text style={styles.title}>{product.title}</Text>
              <Text style={[styles.price, product.price === 0 && styles.priceFree]}>
                {priceLabel(product.price)}
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Ionicons name="bag-outline" size={14} color={C.accent} />
                <Text style={styles.statText}>{product.purchaseCount ?? 0} purchases</Text>
              </View>
              {isOwnListing ? (
                <View style={styles.stat}>
                  <Ionicons name="pricetag-outline" size={14} color={C.accent} />
                  <Text style={[styles.statText, { color: C.accent }]}>Your listing</Text>
                </View>
              ) : null}
              {product.owned ? (
                <View style={styles.stat}>
                  <Ionicons name="checkmark-circle" size={14} color={C.success} />
                  <Text style={[styles.statText, { color: C.success }]}>In your library</Text>
                </View>
              ) : null}
            </View>

            {product.description ? <Text style={styles.description}>{product.description}</Text> : null}

            {creator ? (
              <View style={styles.creatorCard}>
                <View style={styles.avatar}>
                  {assetUrl(creator.avatarUrl) ? (
                    <Image source={{ uri: assetUrl(creator.avatarUrl) }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="person-outline" size={18} color={C.accent} />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.creatorNameRow}>
                    <Text style={styles.creatorName} numberOfLines={1}>
                      {creator.displayName ?? creator.username ?? "WALLORA creator"}
                    </Text>
                    <VerifiedBadge tier={creator.tier} size="sm" showLabel={false} />
                  </View>
                  {creator.username ? <Text style={styles.creatorHandle}>@{creator.username}</Text> : null}
                  {creator.bio ? <Text style={styles.creatorBio} numberOfLines={2}>{creator.bio}</Text> : null}
                </View>
              </View>
            ) : null}

            {isOwnListing ? (
              <Pressable style={styles.manageButton} onPress={() => router.push("/marketplace/manage")}>
                <Ionicons name="create-outline" size={17} color={C.accent} />
                <Text style={styles.manageButtonText}>Manage this listing</Text>
                <Ionicons name="chevron-forward" size={16} color={C.accent} />
              </Pressable>
            ) : (
              <>
                <View style={styles.noteCard}>
                  <Ionicons name="information-circle-outline" size={16} color={C.blue} />
                  <Text style={styles.noteText}>
                    Purchases are recorded on WALLORA as a demo. No payment details are collected in the app.
                  </Text>
                </View>

                {!user ? (
                  <Pressable style={styles.signInCard} onPress={() => router.push("/auth/login")}>
                    <Ionicons name="lock-closed-outline" size={17} color={C.accent} />
                    <Text style={styles.signInText}>Sign in to add this pack to your library.</Text>
                    <Ionicons name="chevron-forward" size={16} color={C.accent} />
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={() => void purchase()}
                  disabled={purchasing}
                  style={[styles.buyButton, purchasing && styles.buttonDisabled]}
                >
                  {purchasing ? (
                    <ActivityIndicator color={C.bg} size="small" />
                  ) : (
                    <>
                      <Ionicons name="cart-outline" size={18} color={C.bg} />
                      <Text style={styles.buyText}>
                        {product.owned ? "Claim again (demo)" : `Purchase · ${priceLabel(product.price)}`}
                      </Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: S.lg, paddingBottom: S.xxxl },
  state: { alignItems: "center", paddingVertical: 72, gap: S.sm },
  stateText: { fontSize: 13, color: C.muted },
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
    marginBottom: S.md,
  },
  errorText: { flex: 1, color: C.error, fontSize: 12 },
  retryText: { color: C.accent, fontSize: 12, fontWeight: "800" },
  resultBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: S.sm,
    borderWidth: 1,
    borderRadius: R.md,
    backgroundColor: C.card,
    padding: S.md,
    marginBottom: S.md,
  },
  resultTitle: { fontSize: 13, fontWeight: "800" },
  resultNote: { color: C.textSoft, fontSize: 12, lineHeight: 18, marginTop: 3 },
  hero: { width: "100%", aspectRatio: 1.25, borderRadius: R.lg, overflow: "hidden", backgroundColor: C.raised },
  heroImage: { width: "100%", height: "100%" },
  heroFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  licenseBadge: {
    position: "absolute",
    top: S.sm,
    left: S.sm,
    backgroundColor: "rgba(11,12,15,0.85)",
    borderRadius: R.sm,
    paddingHorizontal: S.sm,
    paddingVertical: 4,
  },
  licenseText: { color: C.accent, fontSize: 10, fontWeight: "800" },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: S.md, marginTop: S.lg },
  title: { flex: 1, fontSize: 22, fontWeight: "800", color: C.text },
  price: { fontSize: 20, fontWeight: "800", color: C.accent },
  priceFree: { color: C.success },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: S.lg, marginTop: S.sm },
  stat: { flexDirection: "row", alignItems: "center", gap: 5 },
  statText: { color: C.muted, fontSize: 12 },
  description: { color: C.textSoft, fontSize: 14, lineHeight: 21, marginTop: S.md },
  creatorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    padding: S.md,
    marginTop: S.lg,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 42, height: 42 },
  creatorNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  creatorName: { fontSize: 14, fontWeight: "800", color: C.text, flexShrink: 1 },
  creatorHandle: { fontSize: 11, color: C.muted, marginTop: 2 },
  creatorBio: { fontSize: 11, color: C.muted, lineHeight: 16, marginTop: 4 },
  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: S.sm,
    marginTop: S.md,
    padding: S.md,
    borderRadius: R.md,
    backgroundColor: C.blueDim,
  },
  noteText: { flex: 1, color: C.textSoft, fontSize: 12, lineHeight: 18 },
  signInCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accent + "44",
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: 11,
    marginTop: S.lg,
  },
  signInText: { flex: 1, fontSize: 12, color: C.textSoft },
  manageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.accent + "55",
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: 13,
    marginTop: S.lg,
  },
  manageButtonText: { flex: 1, fontSize: 13, fontWeight: "800", color: C.accent },
  buyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: S.sm,
    backgroundColor: C.accent,
    borderRadius: R.md,
    paddingVertical: 14,
    marginTop: S.lg,
  },
  buyText: { color: C.bg, fontSize: 14, fontWeight: "800" },
  buttonDisabled: { opacity: 0.6 },
});
