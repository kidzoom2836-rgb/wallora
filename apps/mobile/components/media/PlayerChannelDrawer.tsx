import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C, R } from "../../lib/theme";
import { groupLabel, uniqueChannelId, type IptvChannel } from "../../lib/iptv";

/** Translucent quick-switch drawer that overlays the playing video. */
export function PlayerChannelDrawer({
  visible,
  onClose,
  channels,
  activeId,
  favorites,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  channels: IptvChannel[];
  activeId: string;
  favorites: string[];
  onSelect: (channel: IptvChannel) => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return channels;
    return channels.filter((channel) =>
      `${channel.name} ${groupLabel(channel.group)}`.toLowerCase().includes(term),
    );
  }, [channels, query]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel="Close channel drawer" />
        <BlurView intensity={92} tint="dark" style={[styles.drawer, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>QUICK SWITCH</Text>
              <Text style={styles.title}>Channels</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
              <Ionicons name="close" size={18} color={C.white} />
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={C.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Filter channels"
              placeholderTextColor={C.mutedDark}
              style={styles.searchInput}
              autoCorrect={false}
            />
            {!!query && (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={15} color={C.muted} />
              </Pressable>
            )}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => uniqueChannelId(item)}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const id = uniqueChannelId(item);
              const active = id === activeId;
              const favorite = favorites.includes(id);
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  style={[styles.channelRow, active && styles.channelRowActive]}
                >
                  <View style={styles.channelMark}>
                    <Text style={styles.channelMarkText}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.channelName, active && styles.channelNameActive]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.channelGroup} numberOfLines={1}>
                      {groupLabel(item.group)}
                    </Text>
                  </View>
                  {favorite ? <Ionicons name="star" size={13} color={C.accent} /> : null}
                  {active ? <Ionicons name="radio-outline" size={14} color={C.error} /> : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={22} color={C.muted} />
                <Text style={styles.emptyText}>No channels match “{query}”.</Text>
              </View>
            }
          />
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.42)" },
  dismiss: { ...StyleSheet.absoluteFill },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: "86%",
    maxWidth: 380,
    paddingHorizontal: 14,
    borderLeftWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  eyebrow: { color: C.accent, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: C.white, fontSize: 20, fontWeight: "900", marginTop: 2 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 11,
    borderRadius: R.md,
    backgroundColor: "rgba(0,0,0,0.34)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 10,
  },
  searchInput: { flex: 1, color: C.white, fontSize: 12 },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 9,
    borderRadius: R.md,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "transparent",
  },
  channelRowActive: { backgroundColor: C.accentDim, borderColor: C.accent },
  channelMark: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  channelMarkText: { color: C.accentBright, fontSize: 14, fontWeight: "900" },
  channelName: { color: C.textSoft, fontSize: 12, fontWeight: "800" },
  channelNameActive: { color: C.accentBright },
  channelGroup: { color: C.muted, fontSize: 9.5, marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { color: C.muted, fontSize: 11, textAlign: "center" },
});
