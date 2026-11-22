import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";

const C = { bg: "#0B0C0F", card: "#14161B", text: "#F7F7F5", muted: "#9296A1", accent: "#D7B879", border: "#292C33", error: "#E46F75" };

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !username.trim() || !email.trim() || !password) { setError("All fields required"); return; }
    if (name.trim().length < 2) { setError("Display name must be at least 2 characters"); return; }
    if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(username.trim().toLowerCase())) {
      setError("Username: 3–32 lowercase letters, numbers or dashes");
      return;
    }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password needs 8+ characters with a letter and a number");
      return;
    }
    if (!acceptedTerms) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setLoading(true); setError(null);
    const res = await signUp(name.trim(), username.trim(), email.trim(), password, acceptedTerms);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    router.replace("/(tabs)");
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.logoWrap}>
          <View style={styles.logo}><Text style={styles.logoText}>W</Text></View>
          <Text style={styles.title}>WALLORA</Text>
        </View>
        <Text style={styles.heading}>Create your account</Text>
        <Text style={styles.sub}>Join the creative ecosystem</Text>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={C.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {[
          { label: "Display name", value: name, set: setName, placeholder: "Your name", icon: "person-outline" as const },
          { label: "Username", value: username, set: setUsername, placeholder: "yourname", icon: "at-outline" as const, autoCap: "none" as const },
          { label: "Email", value: email, set: setEmail, placeholder: "you@example.com", icon: "mail-outline" as const, kb: "email-address" as const, autoCap: "none" as const },
          { label: "Password", value: password, set: setPassword, placeholder: "••••••••", icon: "lock-closed-outline" as const, secure: true },
        ].map((f) => (
          <View key={f.label} style={styles.field}>
            <Text style={styles.label}>{f.label}</Text>
            <View style={styles.inputRow}>
              <Ionicons name={f.icon} size={18} color={C.muted} style={{ marginLeft: 12 }} />
              <TextInput
                value={f.value}
                onChangeText={f.set}
                placeholder={f.placeholder}
                placeholderTextColor={C.muted}
                secureTextEntry={f.secure}
                keyboardType={f.kb}
                autoCapitalize={f.autoCap ?? "words"}
                style={styles.input}
              />
            </View>
          </View>
        ))}

        <Pressable
          style={styles.termsRow}
          onPress={() => setAcceptedTerms((value) => !value)}
          disabled={loading}
        >
          <View style={[styles.checkbox, acceptedTerms && styles.checkboxActive]}>
            {acceptedTerms && <Ionicons name="checkmark" size={13} color={C.bg} />}
          </View>
          <Text style={styles.termsText}>
            I accept the Terms of Service and Privacy Policy.
          </Text>
        </Pressable>

        <Pressable style={[styles.btn, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color={C.bg} /> : <Text style={styles.btnText}>Create account</Text>}
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Pressable onPress={() => router.push("/auth/login")}>
            <Text style={styles.link}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, justifyContent: "center" },
  logoWrap: { alignItems: "center", marginBottom: 24 },
  logo: { width: 56, height: 56, borderRadius: 14, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  logoText: { fontSize: 28, fontWeight: "bold", color: C.bg },
  title: { fontSize: 20, fontWeight: "bold", color: C.text, letterSpacing: 2 },
  heading: { fontSize: 24, fontWeight: "600", color: C.text, marginBottom: 4 },
  sub: { fontSize: 14, color: C.muted, marginBottom: 20 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, backgroundColor: "rgba(228,111,117,0.1)", borderWidth: 1, borderColor: C.error, marginBottom: 16 },
  errorText: { color: C.error, fontSize: 13, flex: 1 },
  field: { marginBottom: 14 },
  label: { color: C.muted, fontSize: 12, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  input: { flex: 1, color: C.text, padding: 14, fontSize: 15 },
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginTop: 6, marginBottom: 6 },
  checkbox: { width: 19, height: 19, borderRadius: 5, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkboxActive: { backgroundColor: C.accent, borderColor: C.accent },
  termsText: { flex: 1, color: C.muted, fontSize: 12, lineHeight: 18 },
  btn: { backgroundColor: C.accent, paddingVertical: 15, borderRadius: 12, alignItems: "center", marginTop: 8 },
  btnText: { color: C.bg, fontWeight: "700", fontSize: 16 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  footerText: { color: C.muted, fontSize: 14 },
  link: { color: C.accent, fontSize: 14, fontWeight: "600" },
});
