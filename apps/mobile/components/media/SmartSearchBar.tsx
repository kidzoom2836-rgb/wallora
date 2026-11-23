import { useEffect, useRef, useState } from "react";
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

import { C, R } from "../../lib/theme";

const RECENT_KEY = "wallora.tv.searchRecent.v1";
const POPULAR_GROUPS = ["News", "Sports", "Movies", "Kids", "Music"];
const MAX_RECENT = 6;
const DEBOUNCE_MS = 260;

/** Debounced channel search with local recent searches and group suggestions. */
export function SmartSearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder = "Search channels or groups",
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: (text: string) => void;
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
    AsyncStorage.getItem(RECENT_KEY)
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
    AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
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
  recentBlock: { marginTop: 12 },
  recentHeading: { flexDirection: "row", alignItems: "center", gap: 5 },
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
