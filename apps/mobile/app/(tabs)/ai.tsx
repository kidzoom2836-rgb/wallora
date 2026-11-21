import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";

const C = { bg: "#0B0C0F", card: "#14161B", text: "#F7F7F5", muted: "#9296A1", accent: "#D7B879", border: "#292C33" };
const API = "http://192.168.100.9:3000";

export default function AiScreen() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    const next = [...messages, { role: "user", content: userMsg }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setMessages((m) => [...m, { role: "assistant", content: data.content }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={20} color={C.accent} />
        <Text style={styles.title}>WALLORA AI</Text>
      </View>
      <ScrollView style={styles.chat} contentContainerStyle={{ padding: 12, gap: 8 }}>
        {messages.length === 0 && (
          <View style={styles.emptyWrap}>
            <Ionicons name="sparkles-outline" size={40} color={C.muted} />
            <Text style={styles.empty}>Start a conversation. Try: "Give me five wallpapers for a dark setup."</Text>
          </View>
        )}
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.aiBubble]}>
            <Text style={styles.bubbleText}>{m.content}</Text>
          </View>
        ))}
        {loading && <ActivityIndicator color={C.accent} />}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Message WALLORA AI…"
          placeholderTextColor={C.muted}
          style={styles.input}
          multiline
        />
        <Pressable style={styles.sendBtn} onPress={send} disabled={loading}>
          <Ionicons name="send" size={18} color={C.bg} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8, padding: 16, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 20, fontWeight: "600", color: C.text },
  chat: { flex: 1 },
  emptyWrap: { alignItems: "center", marginTop: 60, gap: 12 },
  empty: { color: C.muted, fontSize: 14, textAlign: "center", paddingHorizontal: 20 },
  bubble: { padding: 12, borderRadius: 12, maxWidth: "85%" },
  userBubble: { alignSelf: "flex-end", backgroundColor: C.accent },
  aiBubble: { alignSelf: "flex-start", backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  bubbleText: { color: C.text, fontSize: 14 },
  composer: { flexDirection: "row", padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: C.border, alignItems: "flex-end" },
  input: { flex: 1, backgroundColor: C.card, color: C.text, borderRadius: 12, padding: 12, fontSize: 14, borderWidth: 1, borderColor: C.border, maxHeight: 100 },
  sendBtn: { backgroundColor: C.accent, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
});
