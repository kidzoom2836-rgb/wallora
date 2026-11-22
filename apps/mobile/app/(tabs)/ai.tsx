import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { ScrollViewInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { apiJson } from "../../lib/api";
import { withVerification } from "../../lib/verification";
import { C, R } from "../../lib/theme";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Chip } from "../../components/ui/States";

const THINKING_STAGES = [
  "Understanding your request",
  "Thinking",
  "Writing the response",
  "Almost there",
];

interface Mode {
  id: string;
  name: string;
  shortName: string;
  description: string;
  starterPrompts: string[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  error?: string;
}

interface Conversation {
  id: string;
  title: string;
  mode: string;
  messageCount?: number;
}

export default function AiScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const modeRef = useRef("creative-assistant");

  const [modes, setModes] = useState<Mode[]>([]);
  const [mode, setMode] = useState("creative-assistant");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadConversation = useCallback(async (nextMode?: string) => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiJson<Conversation[]>("/api/v1/ai/conversations");
      const targetMode = nextMode ?? modeRef.current;
      let conv = list?.[0] ?? null;
      if (!conv || conv.mode !== targetMode) {
        conv = await apiJson<Conversation>("/api/v1/ai/conversations", {
          method: "POST",
          body: JSON.stringify({ mode: targetMode }),
        });
      }
      setConversation(conv);
      setMode(conv.mode);
      const full = await apiJson<{ messages: Message[] }>(`/api/v1/ai/conversations/${conv.id}`);
      setMessages(full.messages ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Could not start AI chat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    apiJson<Mode[]>("/api/v1/ai/modes")
      .then(setModes)
      .catch(() => {});
    loadConversation().catch(() => {});
  }, [loadConversation]);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 90);
    return () => clearTimeout(timer);
  }, [messages, sending]);

  useEffect(() => {
    if (!sending) {
      setStage(0);
      return;
    }
    const timer = setInterval(() => setStage((s) => (s + 1) % THINKING_STAGES.length), 1900);
    return () => clearInterval(timer);
  }, [sending]);

  const switchMode = async (id: string) => {
    if (id === mode || sending) return;
    setMode(id);
    setMessages([]);
    await loadConversation(id);
  };

  const startNewChat = async () => {
    if (sending) return;
    setError(null);
    setLoading(true);
    try {
      const conv = await apiJson<Conversation>("/api/v1/ai/conversations", {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      setConversation(conv);
      setMessages([]);
    } catch (e: any) {
      setError(e?.message ?? "Could not start a new chat.");
    } finally {
      setLoading(false);
    }
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || !conversation || sending) return;
    setInput("");
    setError(null);
    setSending(true);
    setStage(0);

    const optimistic: Message = { id: `temp-${Date.now()}`, role: "user", content };
    setMessages((m) => [...m, optimistic]);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    try {
      const data = await withVerification(() =>
        apiJson<{ userMessage: Message; assistantMessage: Message; error?: string }>(
          `/api/v1/ai/conversations/${conversation.id}/messages`,
          { method: "POST", body: JSON.stringify({ content }), signal: controller.signal },
        ),
      );
      if (!data) {
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setInput(content);
        return;
      }
      setMessages((m) => [
        ...m.filter((x) => x.id !== optimistic.id),
        data.userMessage,
        data.assistantMessage,
      ]);
      if (data.error) setError(data.error);
    } catch (e: any) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setInput(content);
      setError(
        controller.signal.aborted
          ? "That request took too long. Please try again."
          : e?.message ?? "Could not reach WALLORA AI.",
      );
    } finally {
      clearTimeout(timeout);
      setSending(false);
    }
  };

  const activeMode = modes.find((m) => m.id === mode);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <ScreenHeader
        title="WALLORA AI"
        subtitle={activeMode?.name ?? "Creative assistant"}
        showBack={false}
        transparent
        right={
          <View style={styles.headerRight}>
            <Pressable onPress={startNewChat} hitSlop={10} style={styles.iconButton}>
              <Ionicons name="add-outline" size={21} color={C.text} />
            </Pressable>
            <View style={styles.online}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>LIVE</Text>
            </View>
          </View>
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.modeRow, { paddingTop: 4 }]}
      >
        {modes.map((m) => (
          <Chip key={m.id} label={m.shortName} active={mode === m.id} onPress={() => switchMode(m.id)} />
        ))}
      </ScrollView>

      {error && (
        <Pressable onPress={() => setError(null)} style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color={C.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Ionicons name="close" size={15} color={C.error} />
        </Pressable>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        contentContainerStyle={[styles.chatContent, { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={C.accent} size="large" />
            <Text style={styles.loadingText}>Opening your assistant…</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.welcome}>
            <View style={styles.welcomeOrb}>
              <Ionicons name="sparkles" size={30} color={C.accent} />
            </View>
            <Text style={styles.welcomeTitle}>{activeMode?.name ?? "Your creative partner"}</Text>
            <Text style={styles.welcomeDesc}>
              {activeMode?.description ?? "Ask anything about design, wallpapers or ideas."}
            </Text>
            <View style={styles.prompts}>
              {(activeMode?.starterPrompts ?? ["Suggest a dark premium wallpaper concept"])
                .slice(0, 4)
                .map((prompt) => (
                  <Pressable key={prompt} style={styles.promptCard} onPress={() => send(prompt)}>
                    <Text style={styles.promptText}>{prompt}</Text>
                    <View style={styles.promptArrow}>
                      <Ionicons name="arrow-up" size={14} color={C.bg} />
                    </View>
                  </Pressable>
                ))}
            </View>
          </View>
        ) : (
          messages.map((m) => (
            <View key={m.id} style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.aiBubble]}>
              {m.role === "assistant" && (
                <Ionicons name="sparkles-outline" size={14} color={C.accent} style={styles.bubbleIcon} />
              )}
              <Text style={[styles.bubbleText, m.role === "user" && styles.userBubbleText]}>{m.content}</Text>
            </View>
          ))
        )}

        {sending && (
          <View style={[styles.bubble, styles.aiBubble, styles.thinkingBubble]}>
            <ActivityIndicator color={C.accent} size="small" />
            <Text style={styles.thinkingText}>{THINKING_STAGES[stage]}…</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) + 8 }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={`Ask ${activeMode?.shortName ?? "WALLORA"}…`}
          placeholderTextColor={C.muted}
          style={styles.input}
          multiline
          maxLength={4000}
          onSubmitEditing={() => send()}
        />
        <Pressable
          onPress={() => send()}
          disabled={!input.trim() || sending || !conversation}
          style={({ pressed }) => [styles.sendBtn, (!input.trim() || sending) && styles.sendDisabled, pressed && styles.pressed]}
        >
          {sending ? <ActivityIndicator size="small" color={C.bg} /> : <Ionicons name="arrow-up" size={19} color={C.bg} />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: { width: 34, height: 34, borderRadius: R.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  online: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.card, borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: C.border },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  onlineText: { color: C.muted, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  modeRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderSoft },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 10, padding: 10, borderRadius: R.md, backgroundColor: C.errorDim, borderWidth: 1, borderColor: C.error + "66" },
  errorText: { color: C.error, fontSize: 12, flex: 1 },
  chat: { flex: 1 },
  chatContent: { padding: 14, paddingBottom: 20, gap: 10 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: C.muted, fontSize: 12 },
  welcome: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 10 },
  welcomeOrb: { width: 68, height: 68, borderRadius: 34, backgroundColor: C.card, borderWidth: 1, borderColor: C.accent, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  welcomeTitle: { color: C.text, fontSize: 19, fontWeight: "800" },
  welcomeDesc: { color: C.muted, fontSize: 13, textAlign: "center", lineHeight: 19, marginTop: 6, paddingHorizontal: 22 },
  prompts: { width: "100%", gap: 8, marginTop: 22 },
  promptCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 13 },
  promptText: { color: C.text, fontSize: 13, flex: 1, lineHeight: 18 },
  promptArrow: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "88%", borderRadius: 16, padding: 12 },
  userBubble: { alignSelf: "flex-end", backgroundColor: C.accent, borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: "flex-start", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 4, flexDirection: "row", gap: 7 },
  userBubbleText: { color: C.bg },
  thinkingBubble: { alignItems: "center", paddingVertical: 10 },
  thinkingText: { color: C.muted, fontSize: 12 },
  bubbleIcon: { marginTop: 2 },
  bubbleText: { color: C.text, fontSize: 14, lineHeight: 20, flex: 1 },
  composer: { flexDirection: "row", gap: 9, alignItems: "flex-end", paddingTop: 10, borderTopWidth: 1, borderTopColor: C.borderSoft, backgroundColor: C.bg },
  input: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, color: C.text, fontSize: 14, maxHeight: 110 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  sendDisabled: { backgroundColor: C.raised },
  pressed: { opacity: 0.75 },
});
