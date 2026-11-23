import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { groupLabel, type IptvChannel } from "../../lib/iptv";
import {
  findChannelMatches,
  hasExactChannelText,
  TV_SEARCH_RECENT_KEY,
} from "../../lib/tvSearch";
import { C, R } from "../../lib/theme";

const POPULAR_GROUPS = ["News", "Sports", "Movies", "Kids", "Music"];
const MAX_RECENT = 6;
const DEBOUNCE_MS = 260;

/**
 * Debounced channel finder with typo-tolerant suggestions, recent searches and
 * group shortcuts. Suggestions are ranked locally from the loaded guide.
 */
export function SmartSearchBar({
  value,
  onChangeText,
  onSubmit,
  channels,
  onSelectChannel,
  placeholder = "Search channels or groups",
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: (text: string) => void;
  channels?: IptvChannel[];
  onSelectChannel?: (channel: IptvChannel) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<TextInputInstance>(null);
  const lastEmitted = useRef(value);
  const recentRef = useRef<string[]>([]);
  const changeRef = useRef(onChangeText);

  useEffect(() => {
    changeRef.current = onChangeText;
  }, [onChangeText]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(TV_SEARCH_RECENT_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        const parsed: unknown = JSON.parse(raw);
        const items = Array.isArray(parsed)
          ? parsed.filter((item): item is string => typeof item === "string")
          : [];
        const next = items.slice(0, MAX_RECENT);
        recentRef.current = next;
        setRecent(next);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    if (text === lastEmitted.current) return;
    const timer = setTimeout(() => {
      lastEmitted.current = text;
      changeRef.current(text);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const trimmed = text.trim();
  const matches = useMemo(
    () => (trimmed && channels?.length ? findChannelMatches(channels, trimmed, 6) : []),
    [channels, trimmed],
  );
  const hasExact = useMemo(
    () => !!trimmed && !!channels?.length && hasExactChannelText(channels, trimmed),
    [channels, trimmed],
  );
  const didYouMean = !hasExact && matches.length > 0 ? matches[0] : null;
  const listMatches = didYouMean ? matches.slice(1, 5) : matches.slice(0, 5);
  const showSuggestions = focused && !!trimmed;

  const emitNow = (next: string) => {
    lastEmitted.current = next;
    setText(next);
    changeRef.current(next);
  };

  const remember = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    const next = [
      clean,
      ...recentRef.current.filter(
        (item) => item.toLowerCase() !== clean.toLowerCase(),
      ),
    ].slice(0, MAX_RECENT);
    recentRef.current = next;
    setRecent(next);
    AsyncStorage.setItem(TV_SEARCH_RECENT_KEY, JSON.stringify(next)).catch(() => {});
  };

  const handleSubmit = () => {
    const clean = text.trim();
    emitNow(clean);
    remember(clean);
    onSubmit?.(clean);
    Keyboard.dismiss();
  };

  const chooseSuggestion = (group: string) => {
    emitNow(group);
    remember(group);
    inputRef.current?.focus();
  };

  const selectMatch = (channel: IptvChannel) => {
    emitNow(channel.name);
    remember(channel.name);
    onSelectChannel?.(channel);
    Keyboard.dismiss();
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.inputRow, focused && styles.inputRowFocused]}>
        <Ionicons name="search-outline" size={17} color={C.muted} />
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={handleSubmit}
          placeholder={placeholder}
          placeholderTextColor={C.mutedDark}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          blurOnSubmit
          accessibilityLabel="Search WALLORA Live TV channels"
        />
        {!!text && (
          <Pressable
            onPress={() => emitNow("")}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={C.muted} />
          </Pressable>
        )}
      </View>

      {showSuggestions && (
        <View style={styles.suggestionsBlock}>
          <View style={styles.recentHeading}>
            <Ionicons
              name={didYouMean ? "sparkles-outline" : "list-outline"}
              size={12}
              color={C.accent}
            />
            <Text style={styles.recentHeadingText}>
              {didYouMean ? "DID YOU MEAN" : "CHANNEL MATCHES"}
            </Text>
          </View>

          {didYouMean && (
            <Pressable
              onPressIn={() => selectMatch(didYouMean.channel)}
              style={({ pressed }) => [
                styles.suggestionRow,
                styles.didYouMeanRow,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="bulb-outline" size={16} color={C.accent} />
              <View style={styles.suggestionText}>
                <Text style={styles.suggestionName} numberOfLines={1}>
                  {didYouMean.channel.name}
                </Text>
                <Text style={styles.suggestionMeta} numberOfLines={1}>
                  {groupLabel(didYouMean.channel.group)}
                </Text>
              </View>
              <Text style={styles.tapText}>USE</Text>
            </Pressable>
          )}

          {listMatches.map(({ channel }, index) => (
            <Pressable
              key={`${channel.url}-${index}`}
              onPressIn={() => selectMatch(channel)}
              style={({ pressed }) => [styles.suggestionRow, pressed && styles.pressed]}
            >
              <Ionicons name="tv-outline" size={15} color={C.muted} />
              <View style={styles.suggestionText}>
                <Text style={styles.suggestionName} numberOfLines={1}>
                  {channel.name}
                </Text>
                <Text style={styles.suggestionMeta} numberOfLines={1}>
                  {groupLabel(channel.group)}
                </Text>
              </View>
              <Ionicons name="arrow-forward-outline" size={14} color={C.mutedDark} />
            </Pressable>
          ))}

          {!matches.length && (
            <Text style={styles.emptyMatch}>
              No close channel found. Try a group like News or Sports.
            </Text>
          )}
        </View>
      )}

      {focused && !text && recent.length > 0 && (
        <View style={styles.recentBlock}>
          <View style={styles.recentHeading}>
            <Ionicons name="time-outline" size={12} color={C.muted} />
            <Text style={styles.recentHeadingText}>RECENT SEARCHES</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {recent.map((item) => (
              <Pressable
                key={item}
                onPress={() => chooseSuggestion(item)}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
              >
                <Text style={styles.chipText} numberOfLines={1}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {!showSuggestions && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Text style={styles.suggestionLabel}>TRY</Text>
          {POPULAR_GROUPS.map((group) => (
            <Pressable
              key={group}
              onPress={() => chooseSuggestion(group)}
              style={({ pressed }) => [
                styles.chip,
                styles.suggestionChip,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="flame-outline" size={11} color={C.accent} />
              <Text style={styles.chipText} numberOfLines={1}>
                {group}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 16 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  inputRowFocused: { borderColor: C.accent, backgroundColor: C.bgElevated },
  input: { flex: 1, color: C.text, fontSize: 13 },
  suggestionsBlock: {
    marginTop: 10,
    paddingHorizontal: 11,
    paddingBottom: 4,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderSoft,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSoft,
  },
  didYouMeanRow: {
    marginTop: 7,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: "rgba(215,184,121,0.35)",
    backgroundColor: C.accentDim,
  },
  suggestionText: { flex: 1 },
  suggestionName: { color: C.text, fontSize: 12, fontWeight: "800" },
  suggestionMeta: { color: C.muted, fontSize: 10, marginTop: 1 },
  tapText: { color: C.accent, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  emptyMatch: { color: C.muted, fontSize: 11, paddingVertical: 12 },
  recentBlock: { marginTop: 12 },
  recentHeading: { flexDirection: "row", alignItems: "center", gap: 5, paddingTop: 9 },
  recentHeadingText: {
    color: C.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  chips: { flexDirection: "row", alignItems: "center", gap: 7, paddingTop: 9 },
  suggestionLabel: {
    color: C.mutedDark,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginRight: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: 140,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: R.pill,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
  },
  suggestionChip: { backgroundColor: C.accentDim, borderColor: "rgba(215,184,121,0.28)" },
  chipText: { color: C.textSoft, fontSize: 10.5, fontWeight: "700" },
  pressed: { opacity: 0.65 },
});
