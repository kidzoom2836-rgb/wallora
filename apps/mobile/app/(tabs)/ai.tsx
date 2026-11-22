import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import type { ScrollViewInstance } from "react-native";
import { useState, useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { apiJson } from "../../lib/api";

const C = { bg: "#0B0C0F", card: "#14161B", raised: "#1C1F26", text: "#F7F7F5", muted: "#9296A1", accent: "#D7B879", border: "#292C33", error: "#E46F75" };

const THINKING_STAGES = ["Understanding your request", "Thinking", "Writing the response", "Almost there"];

interface Mode {
  id: string;
  name: string;
  shortName: string;
  description: string;
  starterPrompts: string[];
}
interface Message { id: string; role: "user" | "assistant"; content: string; }
interface Conversation { id: string; title: string; mode: string; messageCount: number; }

export default function AiScreen() {
  const [modes, setModes] = useState<Mode[]>([]);
  const [mode, setMode] = useState("creative-assistant");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    apiJson<Mode[]>("/api/v1/ai/modes").then(setModes).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await apiJson<Conversation[]>("/api/v1/ai/conversations");
        let conv = list?.[0] ?? null;
        if (!conv) {
          conv = await apiJson<Conversation>("/api/v1/ai/conversations", {
            method: "POST",
            body: JSON.stringify({ mode: "creative-assistant" }),
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
    })();
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages, sending]);

  // Visible progress while a response is generated.
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
    setLoading(true);
    setError(null);
    try {
      const conv = await apiJson<Conversation>("/api/v1/ai/conversations", {
        method: "POST",
        body: JSON.stringify({ mode: id }),
      });
      setConversation(conv);
      setMessages([]);
    } catch (e: any) {
      setError(e?.message ?? "Could not switch mode.");
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    const optimistic: Message = { id: `temp-${Date.now()}`, role: "user", content };
    setMessages((m) => [...m, optimistic]);
    try {
      const data = await apiJson<{ userMessage: Message; assistantMessage: Message; error?: string; tokensUsed?: number }>(
        `/api/v1/ai/conversations/${conversation.id}/messages`,
        { method: "POST", body: JSON.stringify({ content }), signal: controller.signal },
      );
      setMessages((m) => [
        ...m.filter((x) => x.id !== optimistic.id),
        data.userMessage,
        data.assistantMessage,
      ]);
      if (data.error) setError(data.error);
    } catch (e: any) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <View style={styles.headerIcon}><Ionicons name="sparkles" size={19} color={C.bg} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>WALLORA AI</Text>
          <Text style={styles.sub}>{activeMode?.name ?? "Creative assistant"}</Text>
        </View>
        <View style={styles.online}><View style={styles.onlineDot} /><Text style={styles.onlineText}>LIVE</Text></View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRow}>
        {modes.map((m) => (
          <Pressable key={m.id} onPress={() => switchMode(m.id)} style={[styles.modeChip, mode === m.id && styles.modeChipActive]}>
            <Text style={[styles.modeText, mode === m.id && styles.modeTextActive]}>{m.shortName}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {error && (
        <Pressable style={styles.errorBox} onPress={() => setError(null)}>
          <Ionicons name="alert-circle-outline" size={16} color={C.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Ionicons name="close" size={15} color={C.error} />
        </Pressable>
      )}

      <ScrollView ref={scrollRef} style={styles.chat} contentContainerStyle={styles.chatContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centered}><ActivityIndicator color={C.accent} /></View>
        ) : messages.length === 0 ? (
          <View style={styles.welcome}>
            <View style={styles.welcomeOrb}><Ionicons name="sparkles" size={30} color={C.accent} /></View>
            <Text style={styles.welcomeTitle}>{activeMode?.name ?? "Your creative partner"}</Text>
            <Text style={styles.welcomeDesc}>{activeMode?.description ?? "Ask anything about design, wallpapers or ideas."}</Text>
            <View style={styles.prompts}>
              {(activeMode?.starterPrompts ?? ["Suggest a dark premium wallpaper concept"]).slice(0, 3).map((p) => (
                <Pressable key={p} style={styles.promptCard} onPress={() => send(p)}>
                  <Text style={styles.promptText}>{p}</Text>
                  <Ionicons name="arrow-up" size={15} color={C.accent} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          messages.map((m) => (
            <View key={m.id} style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.aiBubble]}>
              {m.role === "assistant" && <Ionicons name="sparkles-outline" size={14} color={C.accent} style={styles.bubbleIcon} />}
              <Text style={styles.bubbleText}>{m.content}</Text>
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

      <View style={styles.composer}>
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
        <Pressable style={[styles.sendBtn, !input.trim() && styles.sendDisabled]} onPress={() => send()} disabled={!input.trim() || sending}>
          {sending ? <ActivityIndicator size="small" color={C.bg} /> : <Ionicons name="arrow-up" size={19} color={C.bg} />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  headerIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  title: { color: C.text, fontSize: 17, fontWeight: "700" },
  sub: { color: C.muted, fontSize: 12, marginTop: 1 },
  online: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: C.border },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#5FB98A" },
  onlineText: { color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  modeRow: { gap: 7, paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border },
  modeChip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  modeChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  modeText: { color: C.muted, fontSize: 12, fontWeight: "600" },
  modeTextActive: { color: C.bg, fontWeight: "700" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: "rgba(228,111,117,0.1)", borderWidth: 1, borderColor: C.error },
  errorText: { color: C.error, fontSize: 12, flex: 1 },
  chat: { flex: 1 },
  chatContent: { padding: 14, paddingBottom: 24, gap: 10 },
  centered: { paddingTop: 40, alignItems: "center" },
  welcome: { paddingTop: 26, alignItems: "center" },
  welcomeOrb: { width: 66, height: 66, borderRadius: 33, backgroundColor: C.card, borderWidth: 1, borderColor: C.accent, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  welcomeTitle: { color: C.text, fontSize: 19, fontWeight: "700" },
  welcomeDesc: { color: C.muted, fontSize: 13, textAlign: "center", lineHeight: 19, marginTop: 6, paddingHorizontal: 26 },
  prompts: { width: "100%", gap: 8, marginTop: 22 },
  promptCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 13 },
  promptText: { color: C.text, fontSize: 13, flex: 1, lineHeight: 18 },
  bubble: { maxWidth: "86%", borderRadius: 16, padding: 12 },
  userBubble: { alignSelf: "flex-end", backgroundColor: C.accent, borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: "flex-start", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 4, flexDirection: "row", gap: 7 },
  thinkingBubble: { alignItems: "center", paddingVertical: 10 },
  thinkingText: { color: C.muted, fontSize: 13 },
  bubbleIcon: { marginTop: 2 },
  bubbleText: { color: C.text, fontSize: 14, lineHeight: 20, flex: 1 },
  composer: { flexDirection: "row", gap: 9, alignItems: "flex-end", padding: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  input: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, color: C.text, fontSize: 14, maxHeight: 110 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  sendDisabled: { backgroundColor: C.raised },
});
