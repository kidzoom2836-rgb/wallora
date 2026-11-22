import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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

interface AssistantSuggestion {
  id: string;
  label: string;
  prompt: string;
}

/** Old [SUGGEST:...] tokens become model questions — never app navigation. */
function legacyPrompt(action: string, value: string): string {
  switch (action) {
    case "search_wallpapers":
      return `Recommend WALLORA wallpapers for "${value}". Give me 2-3 specific search phrases and explain what each one will find.`;
    case "enhance_prompt":
      return `Enhance this image generation prompt and explain the changes: ${value}`;
    case "create_project":
      return `Help me plan a WALLORA project called "${value}". Include a brief, deliverables and the next three steps.`;
    case "open_builder":
      return `Create a detailed build plan for: ${value}. Include pages, sections, interactions and visual direction.`;
    default:
      return `Tell me more about ${value}.`;
  }
}

/**
 * Pull follow-ups from the model response itself. `Follow-up:` lines are
 * clickable prompts inside this chat, so the assistant never opens another
 * screen. Legacy action tokens are supported for older saved conversations.
 */
function parseAssistant(content: string): { text: string; suggestions: AssistantSuggestion[] } {
  const suggestions: AssistantSuggestion[] = [];
  let text = content.replace(/\[SUGGEST:(\w+):([^\]]+)\]/g, (_token, action: string, value: string) => {
    const prompt = legacyPrompt(action, value.trim());
    suggestions.push({ id: `legacy-${suggestions.length}`, label: value.trim(), prompt });
    return "";
  });

  text = text.replace(/^\s*Follow-up:\s*(.+)$/gim, (_line, question: string) => {
    const prompt = question.trim();
    if (prompt) {
      suggestions.push({
        id: `follow-${suggestions.length}`,
        label: prompt.length > 72 ? `${prompt.slice(0, 69)}...` : prompt,
        prompt,
      });
    }
    return "";
  });

  return { text: text.trim(), suggestions: suggestions.slice(0, 3) };
}

export default function AiScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const modeRef = useRef("creative-assistant");

  const [modes, setModes] = useState<Mode[]>([]);
  const [mode, setMode] = useState("creative-assistant");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showConversations, setShowConversations] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
      const available = Array.isArray(list) ? list : [];
      setConversations(available);
      const targetMode = nextMode ?? modeRef.current;
      let conv = available[0] ?? null;
      if (!conv || conv.mode !== targetMode) {
        const created = await apiJson<Conversation>("/api/v1/ai/conversations", {
          method: "POST",
          body: JSON.stringify({ mode: targetMode }),
        });
        conv = created;
        setConversations((prev) => [created, ...prev]);
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
    const active = conversation;
    setMode(id);
    modeRef.current = id;
    setMessages([]);
    setError(null);
    if (!active) {
      await loadConversation(id);
      return;
    }
    try {
      const updated = await apiJson<Pick<Conversation, "id" | "title" | "mode">>(
        `/api/v1/ai/conversations/${active.id}`,
        { method: "PATCH", body: JSON.stringify({ mode: id }) },
      );
      setConversations((prev) =>
        prev.map((c) => (c.id === active.id ? { ...c, ...updated } : c)),
      );
      const full = await apiJson<{ messages: Message[] }>(
        `/api/v1/ai/conversations/${active.id}`,
      );
      setMessages(full?.messages ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Could not change the conversation mode.");
    }
  };

  const openConversation = async (target: Conversation) => {
    if (sending) return;
    setError(null);
    setLoading(true);
    setConversation(target);
    setMode(target.mode);
    modeRef.current = target.mode;
    setMessages([]);
    setShowConversations(false);
    try {
      const full = await apiJson<{ messages: Message[] }>(
        `/api/v1/ai/conversations/${target.id}`,
      );
      setMessages(full?.messages ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Could not open this conversation.");
    } finally {
      setLoading(false);
    }
  };

  const deleteConversation = async (target: Conversation) => {
    if (sending || deletingId) return;
    setDeletingId(target.id);
    setError(null);
    try {
      await apiJson(`/api/v1/ai/conversations/${target.id}`, { method: "DELETE" });
      const remaining = conversations.filter((c) => c.id !== target.id);
      setConversations(remaining);
      if (conversation?.id === target.id) {
        setConversation(null);
        setMessages([]);
        if (remaining[0]) await openConversation(remaining[0]);
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not delete this conversation.");
    } finally {
      setDeletingId(null);
    }
  };

  const startNewChat = async () => {
    if (sending) return;
    setError(null);
    setLoading(true);
    setShowConversations(false);
    try {
      const conv = await apiJson<Conversation>("/api/v1/ai/conversations", {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      setConversation(conv);
      setConversations((prev) => [conv, ...prev]);
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
        setError("Claim your free WALLORA tick to use AI chat.");
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

  const handleSuggestion = (suggestion: AssistantSuggestion) => {
    void send(suggestion.prompt);
  };

  const activeMode = modes.find((m) => m.id === mode);
  const modeLabel = (id: string) => modes.find((m) => m.id === id)?.shortName ?? id;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ScreenHeader
        title="WALLORA AI"
        subtitle={activeMode?.name ?? "Creative assistant"}
        showBack={false}
        transparent
        right={
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => setShowConversations(true)}
              hitSlop={10}
              style={styles.iconButton}
              accessibilityLabel="Chat history"
            >
              <Ionicons name="time-outline" size={19} color={C.text} />
            </Pressable>
            <Pressable
              onPress={() => void startNewChat()}
              disabled={sending}
              hitSlop={10}
              style={[styles.iconButton, sending && styles.iconDisabled]}
              accessibilityLabel="New chat"
            >
              <Ionicons name="square-outline" size={17} color={C.text} />
              <View style={styles.newChatPlus}>
                <Ionicons name="add" size={11} color={C.text} />
              </View>
            </Pressable>
          </View>
        }
      />

      <View style={styles.modeBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.modeRow}
        >
          {modes.map((m) => (
            <Chip key={m.id} label={m.shortName} active={mode === m.id} onPress={() => switchMode(m.id)} />
          ))}
        </ScrollView>
      </View>

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
            <View style={styles.welcomeGlow} />
            <View style={styles.welcomeOrb}>
              <Ionicons name="sparkles" size={28} color={C.accent} />
            </View>
            <Text style={styles.welcomeEyebrow}>WALLORA AI</Text>
            <Text style={styles.welcomeTitle}>What should we create?</Text>
            <Text style={styles.welcomeDesc}>
              Ask for ideas, prompts, plans or answers. Every follow-up stays right here in the chat.
            </Text>
            <View style={styles.prompts}>
              {(activeMode?.starterPrompts ?? ["Suggest a dark premium wallpaper concept"])
                .slice(0, 4)
                .map((prompt) => (
                  <Pressable
                    key={prompt}
                    style={({ pressed }) => [styles.promptCard, pressed && styles.pressed]}
                    onPress={() => void send(prompt)}
                  >
                    <View style={styles.promptIcon}>
                      <Ionicons name="sparkles-outline" size={15} color={C.accent} />
                    </View>
                    <Text style={styles.promptText}>{prompt}</Text>
                    <Ionicons name="arrow-up" size={15} color={C.muted} />
                  </Pressable>
                ))}
            </View>
          </View>
        ) : (
          <View style={styles.messages}>
            {messages.map((m) => {
              if (m.role === "user") {
                return (
                  <View key={m.id} style={styles.userRow}>
                    <View style={styles.userBubble}>
                      <Text style={styles.userText}>{m.content}</Text>
                    </View>
                  </View>
                );
              }
              const parsed = parseAssistant(m.content);
              return (
                <View key={m.id} style={styles.assistantRow}>
                  <View style={styles.assistantAvatar}>
                    <Ionicons name="sparkles-outline" size={14} color={C.accent} />
                  </View>
                  <View style={styles.assistantStack}>
                    <Text style={styles.assistantName}>WALLORA</Text>
                    {parsed.text ? <Text style={styles.assistantText}>{parsed.text}</Text> : null}
                    {parsed.suggestions.length > 0 ? (
                      <View style={styles.suggestionRow}>
                        {parsed.suggestions.map((s) => (
                          <Pressable
                            key={s.id}
                            onPress={() => handleSuggestion(s)}
                            style={({ pressed }) => [styles.suggestionChip, pressed && styles.pressed]}
                          >
                            <Text style={styles.suggestionText} numberOfLines={2}>
                              {s.label}
                            </Text>
                            <Ionicons name="arrow-up" size={11} color={C.accent} />
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}

            {sending && (
              <View style={styles.assistantRow}>
                <View style={styles.assistantAvatar}>
                  <Ionicons name="sparkles-outline" size={14} color={C.accent} />
                </View>
                <View style={styles.assistantStack}>
                  <Text style={styles.assistantName}>WALLORA</Text>
                  <View style={styles.thinkingRow}>
                    <ActivityIndicator color={C.accent} size="small" />
                    <Text style={styles.thinkingText}>{THINKING_STAGES[stage]}…</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) + 8 }]}>
        <View style={styles.inputWrap}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={`Message ${activeMode?.shortName ?? "WALLORA"}…`}
            placeholderTextColor={C.muted}
            style={styles.input}
            multiline
            maxLength={4000}
            returnKeyType="send"
            onSubmitEditing={() => void send()}
          />
          <Pressable
            onPress={() => void send()}
            disabled={!input.trim() || sending || !conversation}
            style={({ pressed }) => [
              styles.sendBtn,
              (!input.trim() || sending || !conversation) && styles.sendDisabled,
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Send message"
          >
            {sending ? (
              <ActivityIndicator size="small" color={C.bg} />
            ) : (
              <Ionicons name="arrow-up" size={19} color={C.bg} />
            )}
          </Pressable>
        </View>
        <Text style={styles.composerNote}>Follow-ups stay in this chat · WALLORA AI can make mistakes</Text>
      </View>

      <Modal
        visible={showConversations}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConversations(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowConversations(false)}>
          <Pressable style={styles.historySheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Conversations</Text>
              <Pressable onPress={() => setShowConversations(false)} hitSlop={10}>
                <Ionicons name="close" size={20} color={C.muted} />
              </Pressable>
            </View>
            <ScrollView style={styles.historyList}>
              {conversations.length === 0 ? (
                <Text style={styles.historyEmpty}>No conversations yet. Start chatting to begin.</Text>
              ) : (
                conversations.map((c) => {
                  const active = conversation?.id === c.id;
                  const busyDelete = deletingId === c.id;
                  return (
                    <View
                      key={c.id}
                      style={[styles.historyRow, active && styles.historyRowActive]}
                    >
                      <Pressable
                        onPress={() => void openConversation(c)}
                        disabled={sending || busyDelete}
                        style={styles.historySelect}
                      >
                        <Ionicons
                          name="chatbubble-outline"
                          size={16}
                          color={active ? C.accent : C.muted}
                        />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.historyItemTitle} numberOfLines={1}>
                            {c.title || "New conversation"}
                          </Text>
                          <Text style={styles.historyItemMeta} numberOfLines={1}>
                            {modeLabel(c.mode)} · {c.messageCount ?? 0} messages
                          </Text>
                        </View>
                      </Pressable>
                      <Pressable
                        onPress={() => void deleteConversation(c)}
                        disabled={sending || !!deletingId}
                        hitSlop={8}
                        style={styles.historyDelete}
                      >
                        {busyDelete ? (
                          <ActivityIndicator size="small" color={C.error} />
                        ) : (
                          <Ionicons name="trash-outline" size={16} color={C.error} />
                        )}
                      </Pressable>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconDisabled: { opacity: 0.5 },
  newChatPlus: { position: "absolute", right: 4, top: 4 },
  modeBar: { borderBottomWidth: 1, borderBottomColor: C.borderSoft },
  modeRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10,
    borderRadius: R.md,
    backgroundColor: C.errorDim,
    borderWidth: 1,
    borderColor: C.error + "66",
  },
  errorText: { color: C.error, fontSize: 12, flex: 1 },
  chat: { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingVertical: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: C.muted, fontSize: 12 },
  welcome: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 420 },
  welcomeGlow: {
    position: "absolute",
    top: "18%",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(215,184,121,0.08)",
  },
  welcomeOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.accent + "88",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  welcomeEyebrow: {
    color: C.accent,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  welcomeTitle: { color: C.text, fontSize: 24, fontWeight: "800", marginTop: 8, textAlign: "center" },
  welcomeDesc: {
    color: C.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 8,
    paddingHorizontal: 18,
  },
  prompts: { width: "100%", gap: 8, marginTop: 26 },
  promptCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    padding: 13,
  },
  promptIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  promptText: { color: C.textSoft, fontSize: 13, flex: 1, lineHeight: 18 },
  messages: { gap: 20, paddingBottom: 12 },
  userRow: { alignItems: "flex-end" },
  userBubble: {
    maxWidth: "85%",
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    borderBottomRightRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  userText: { color: C.text, fontSize: 14, lineHeight: 20 },
  assistantRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accent + "55",
    alignItems: "center",
    justifyContent: "center",
  },
  assistantStack: { flex: 1, minWidth: 0, gap: 6 },
  assistantName: { color: C.accent, fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  assistantText: { color: C.text, fontSize: 14, lineHeight: 21 },
  thinkingRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 4 },
  thinkingText: { color: C.muted, fontSize: 12 },
  suggestionRow: { gap: 7, marginTop: 6 },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    maxWidth: "100%",
    borderWidth: 1,
    borderColor: C.accent + "44",
    backgroundColor: C.accentDim,
    borderRadius: R.md,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  suggestionText: { color: C.accent, fontSize: 12, lineHeight: 16, flexShrink: 1 },
  composer: {
    borderTopWidth: 1,
    borderTopColor: C.borderSoft,
    backgroundColor: C.bg,
    paddingTop: 10,
    paddingHorizontal: 14,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 22,
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 5,
  },
  input: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    lineHeight: 20,
    maxHeight: 110,
    paddingVertical: 7,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { backgroundColor: C.raised },
  composerNote: {
    color: C.mutedDark,
    fontSize: 10,
    textAlign: "center",
    marginTop: 7,
  },
  pressed: { opacity: 0.72 },
  modalBackdrop: { flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" },
  historySheet: {
    maxHeight: "78%",
    backgroundColor: C.bgElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    paddingBottom: 20,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.raisedHover,
    alignSelf: "center",
    marginTop: 10,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  historyTitle: { color: C.text, fontSize: 16, fontWeight: "800" },
  historyList: { paddingHorizontal: 12 },
  historyEmpty: { color: C.muted, fontSize: 12, textAlign: "center", paddingVertical: 30 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    marginBottom: 7,
  },
  historyRowActive: { borderColor: C.accent + "66", backgroundColor: C.raised },
  historySelect: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 11 },
  historyItemTitle: { color: C.text, fontSize: 12, fontWeight: "700" },
  historyItemMeta: { color: C.muted, fontSize: 10, marginTop: 2 },
  historyDelete: { width: 38, alignItems: "center", justifyContent: "center", alignSelf: "stretch" },
});
