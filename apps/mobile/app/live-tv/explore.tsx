import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { buildBrowseMaps } from "../../lib/tvBrowse";
import { getTvSettings } from "../../lib/tvSettings";
import { loadPlaylist, type IptvChannel } from "../../lib/iptv";
import { C, R } from "../../lib/theme";

type ExploreSection = {
  key: "group" | "country" | "genre" | "all";
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  values: string[];
};

/** Dedicated browse pages: categories, countries, genres and the full A-Z guide. */
export default function LiveTvExploreScreen() {
  const [channels, setChannels] = useState<IptvChannel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [playlist, settings] = await Promise.all([
        loadPlaylist(),
        getTvSettings(),
      ]);
      if (!alive) return;
      const visible = playlist.channels.filter((channel) => {
        if (settings.hideGeoBlocked && channel.geoBlocked) return false;
        if (settings.hideNot24x7 && channel.not24x7) return false;
        if (settings.httpsOnly && channel.insecure) return false;
        return true;
      });
      setChannels(visible);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const sections = useMemo<ExploreSection[]>(() => {
    const maps = buildBrowseMaps(channels);
    return [
      {
        key: "group",
        label: "Categories",
        subtitle: "News, sports, movies, kids and more",
        icon: "pricetags-outline",
        values: maps.groups,
      },
      {
        key: "country",
        label: "Countries",
        subtitle: "Local channels from around the world",
        icon: "earth-outline",
        values: maps.countries,
      },
      {
        key: "genre",
        label: "Genres",
        subtitle: "Jump straight into what you love",
        icon: "film-outline",
        values: maps.genres,
      },
      {
        key: "all",
        label: "A–Z channels",
        subtitle: "Every channel in the current guide",
        icon: "grid-outline",
        values: ["Browse all channels"],
      },
    ];
  }, [channels]);

  const open = (key: "recommended" | ExploreSection["key"], value?: string) => {
    router.push({
      pathname: "/live-tv/collection",
      params: {
        type: key,
        ...(value ? { value } : {}),
        sort: key === "all" ? "az" : "recommended",
      },
    });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Explore TV"
        subtitle="Categories, countries and genres"
      />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable
            onPress={() => open("recommended")}
            style={({ pressed }) => [styles.heroCard, pressed && styles.pressed]}
          >
            <View style={styles.heroGlow} />
            <Ionicons name="sparkles" size={22} color={C.accent} />
            <Text style={styles.heroTitle}>Recommended for you</Text>
            <Text style={styles.heroSubtitle}>
              Your favorites, watch history and community picks in one feed.
            </Text>
            <View style={styles.heroCta}>
              <Text style={styles.heroCtaText}>Open my feed</Text>
              <Ionicons name="arrow-forward" size={14} color={C.bg} />
            </View>
          </Pressable>

          {sections.map((section) => (
            <View key={section.key} style={styles.section}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionIcon}>
                  <Ionicons name={section.icon} size={16} color={C.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{section.label}</Text>
                  <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
                </View>
              </View>
              <View style={styles.chipWrap}>
                {(section.values.length ? section.values : ["None available"]).map(
                  (value) => (
                    <Pressable
                      key={value}
                      disabled={!section.values.length}
                      onPress={() => open(section.key, value)}
                      style={({ pressed }) => [
                        styles.chip,
                        pressed && styles.pressed,
                        !section.values.length && styles.disabled,
                      ]}
                    >
                      <Text style={styles.chipText} numberOfLines={1}>
                        {value}
                      </Text>
                      {!!section.values.length && (
                        <Ionicons
                          name="chevron-forward"
                          size={12}
                          color={C.muted}
                        />
                      )}
                    </Pressable>
                  ),
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 44 },
  heroCard: {
    padding: 18,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: "rgba(215,184,121,0.3)",
    backgroundColor: C.accentDim,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    right: -60,
    top: -80,
    borderRadius: 90,
    backgroundColor: "rgba(215,184,121,0.12)",
  },
  heroTitle: { color: C.text, fontSize: 20, fontWeight: "900", marginTop: 10 },
  heroSubtitle: {
    color: C.textSoft,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 5,
    maxWidth: 300,
  },
  heroCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 14,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: R.pill,
    backgroundColor: C.accent,
  },
  heroCtaText: { color: C.bg, fontSize: 11, fontWeight: "900" },
  section: { marginTop: 24 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: C.text, fontSize: 14, fontWeight: "900" },
  sectionSubtitle: { color: C.muted, fontSize: 10.5, marginTop: 2 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: R.pill,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipText: { color: C.textSoft, fontSize: 11, fontWeight: "800" },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.4 },
});
