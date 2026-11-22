import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";

const C = { bg: "#0B0C0F", card: "#14161B", text: "#F7F7F5", muted: "#9296A1", accent: "#D7B879", border: "#292C33", error: "#E46F75" };

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) { setError("Email and password required"); return; }
    setLoading(true); setError(null);
    const res = await signIn(email.trim(), password);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    router.replace("/(tabs)");
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.container}>
        <View style={styles.logoWrap}>
          <View style={styles.logo}><Text style={styles.logoText}>W</Text></View>
          <Text style={styles.title}>WALLORA</Text>
        </View>
        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.sub}>Sign in to your account</Text>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={C.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={C.muted} keyboardType="email-address" autoCapitalize="none" style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.pwRow}>
            <TextInput value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={C.muted} secureTextEntry={!showPw} style={styles.pwInput} />
            <Pressable onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
              <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={20} color={C.muted} />
            </Pressable>
          </View>
        </View>

        <Pressable style={[styles.btn, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color={C.bg} /> : <Text style={styles.btnText}>Sign in</Text>}
        </Pressable>

        <Pressable onPress={() => router.push("/auth/forgot-password")} style={styles.forgotRow}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>No account? </Text>
          <Pressable onPress={() => router.push("/auth/register")}>
            <Text style={styles.link}>Create one</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  logoWrap: { alignItems: "center", marginBottom: 32 },
  logo: { width: 56, height: 56, borderRadius: 14, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  logoText: { fontSize: 28, fontWeight: "bold", color: C.bg },
  title: { fontSize: 20, fontWeight: "bold", color: C.text, letterSpacing: 2 },
  heading: { fontSize: 24, fontWeight: "600", color: C.text, marginBottom: 4 },
  sub: { fontSize: 14, color: C.muted, marginBottom: 20 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, backgroundColor: "rgba(228,111,117,0.1)", borderWidth: 1, borderColor: C.error, marginBottom: 16 },
  errorText: { color: C.error, fontSize: 13, flex: 1 },
  field: { marginBottom: 16 },
  label: { color: C.muted, fontSize: 12, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { backgroundColor: C.card, color: C.text, borderRadius: 12, padding: 14, fontSize: 15, borderWidth: 1, borderColor: C.border },
  pwRow: { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  pwInput: { flex: 1, color: C.text, padding: 14, fontSize: 15 },
  eyeBtn: { padding: 14 },
  btn: { backgroundColor: C.accent, paddingVertical: 15, borderRadius: 12, alignItems: "center", marginTop: 8 },
  btnText: { color: C.bg, fontWeight: "700", fontSize: 16 },
  forgotRow: { alignItems: "flex-end", marginTop: 12 },
  forgotText: { color: C.muted, fontSize: 13, textDecorationLine: "underline" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  footerText: { color: C.muted, fontSize: 14 },
  link: { color: C.accent, fontSize: 14, fontWeight: "600" },
});
