import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  getDuePromo,
  markPromoShown,
  releasePromo,
  type PromoDefinition,
} from "../../lib/promos";
import { C, R, SHADOW } from "../../lib/theme";

const FILL = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const DURATION_SECONDS = 10;
const FIRST_CHECK_DELAY_MS = 4000;
const CHECK_INTERVAL_MS = 30_000;
const BETWEEN_PROMOS_MS = 30_000;

/** Process-wide guard so two hosts (or two checks) can never stack popups. */
let aPromoIsVisible = false;

function isSuppressedPath(pathname: string): boolean {
  return (
    pathname === "/live-tv" ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/")
  );
}

/**
 * Root-level host for the daily contextual promos. Rendered inside
 * AuthProvider, it never renders UI unless a slot is actually due.
 */
export function PromoPopupHost() {
  const pathname = usePathname();
  const router = useRouter();
  const [promo, setPromo] = useState<PromoDefinition | null>(null);
  const [remaining, setRemaining] = useState(DURATION_SECONDS);

  const pathnameRef = useRef(pathname);
  const activePromoRef = useRef<PromoDefinition | null>(null);
  const checkInFlightRef = useRef(false);
  const nextAllowedAtRef = useRef(0);
  const suppressed = isSuppressedPath(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const finish = useCallback(
    (action: "expired" | "skip" | "seeMore") => {
      const current = activePromoRef.current;
      if (!current) return;
      activePromoRef.current = null;
      aPromoIsVisible = false;
      nextAllowedAtRef.current = Date.now() + BETWEEN_PROMOS_MS;
      void markPromoShown(current.id);
      setPromo(null);
      setRemaining(DURATION_SECONDS);
      if (action === "seeMore") router.push(current.route as never);
    },
    [router],
  );

  // Wait for a quiet, allowed screen, then keep checking for the next slot.
  useEffect(() => {
    if (suppressed || promo || activePromoRef.current || aPromoIsVisible) return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const check = () => {
      if (
        cancelled ||
        aPromoIsVisible ||
        checkInFlightRef.current ||
        Date.now() < nextAllowedAtRef.current ||
        isSuppressedPath(pathnameRef.current)
      ) {
        return;
      }

      checkInFlightRef.current = true;
      void getDuePromo()
        .then((due) => {
          if (cancelled) {
            // The host went away before presenting; do not burn the slot.
            if (due) void releasePromo(due.id);
            return;
          }
          if (!due) return;
          if (isSuppressedPath(pathnameRef.current) || aPromoIsVisible) {
            void releasePromo(due.id);
            return;
          }
          activePromoRef.current = due;
          aPromoIsVisible = true;
          setPromo(due);
          setRemaining(DURATION_SECONDS);
        })
        .catch(() => {})
        .finally(() => {
          checkInFlightRef.current = false;
        });
    };

    const firstCheck = setTimeout(() => {
      if (cancelled) return;
      check();
      interval = setInterval(check, CHECK_INTERVAL_MS);
    }, FIRST_CHECK_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(firstCheck);
      if (interval) clearInterval(interval);
    };
  }, [suppressed, promo]);

  // Wall-clock based countdown so backgrounding cannot pause the 10s window.
  useEffect(() => {
    if (!promo) return;
    const startedAt = Date.now();
    const tick = () => {
      const left = Math.max(
        0,
        DURATION_SECONDS - Math.floor((Date.now() - startedAt) / 1000),
      );
      setRemaining(left);
      if (left === 0) finish("expired");
    };
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [promo, finish]);

  if (!promo) return null;

  const percent = (remaining / DURATION_SECONDS) * 100;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={() => finish("skip")}
    >
      <View style={[FILL, styles.backdrop]}>
        <View
          style={styles.card}
          accessible
          accessibilityRole="alert"
          accessibilityLabel={`${promo.title}. ${promo.body}`}
        >
          <View style={styles.brandRow}>
            <View style={styles.brand}>
              <Ionicons name="sparkles" size={13} color={C.accent} />
              <Text style={styles.brandText}>WALLORA</Text>
            </View>
            <View style={[styles.timerPill, { borderColor: promo.accent }]}>
              <Text style={[styles.timerText, { color: promo.accent }]}>
                {remaining}s
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: `${promo.accent}1F`,
                borderColor: `${promo.accent}55`,
              },
            ]}
          >
            <Ionicons name={promo.icon} size={23} color={promo.accent} />
          </View>

          <Text style={[styles.eyebrow, { color: promo.accent }]}>
            {promo.eyebrow}
          </Text>
          <Text style={styles.title}>{promo.title}</Text>
          <Text style={styles.body}>{promo.body}</Text>
          <Text style={[styles.ctaHint, { color: promo.accent }]}>
            {promo.ctaLabel}
          </Text>

          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{ now: remaining, min: 0, max: DURATION_SECONDS }}
          >
            <View
              style={[
                styles.progressFill,
                { width: `${percent}%`, backgroundColor: promo.accent },
              ]}
            />
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => finish("seeMore")}
              style={[styles.primary, { backgroundColor: promo.accent }]}
            >
              <Text style={[styles.primaryText, { color: C.bg }]}>See more</Text>
              <Ionicons name="arrow-forward" size={15} color={C.bg} />
            </Pressable>
            <Pressable onPress={() => finish("skip")} style={styles.secondary}>
              <Text style={styles.secondaryText}>Skip</Text>
            </Pressable>
          </View>

          <Text style={styles.footnote}>Closes automatically · once a day</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: C.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    padding: 20,
    borderRadius: R.xl,
    backgroundColor: C.bgElevated,
    borderWidth: 1,
    borderColor: C.border,
    ...SHADOW.hero,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 5 },
  brandText: {
    color: C.textSoft,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  timerPill: {
    minWidth: 38,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: R.pill,
    borderWidth: 1,
  },
  timerText: { fontSize: 11, fontWeight: "800" },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: R.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  title: { color: C.text, fontSize: 19, fontWeight: "800", marginTop: 5 },
  body: {
    color: C.textSoft,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 7,
  },
  ctaHint: { fontSize: 11, fontWeight: "800", marginTop: 9 },
  progressTrack: {
    height: 4,
    borderRadius: R.pill,
    backgroundColor: C.raised,
    overflow: "hidden",
    marginTop: 16,
  },
  progressFill: { height: "100%", borderRadius: R.pill },
  actions: { flexDirection: "row", gap: 9, marginTop: 16 },
  primary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: R.md,
    paddingVertical: 13,
  },
  primaryText: { fontSize: 13, fontWeight: "800" },
  secondary: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  secondaryText: { color: C.textSoft, fontSize: 13, fontWeight: "700" },
  footnote: {
    color: C.mutedDark,
    fontSize: 9.5,
    textAlign: "center",
    marginTop: 12,
  },
});
