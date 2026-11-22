import { useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { apiJson } from "../../lib/api";
import { C, R } from "../../lib/theme";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiJson<{ ok: boolean }>("/api/v1/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email: value }),
      });
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? "Could not send a reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Reset password" subtitle="Account recovery" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.mark}>
            <Ionicons name="key-outline" size={28} color={C.accent} />
          </View>
          <Text style={styles.title}>Forgot your password?</Text>
          <Text style={styles.copy}>
            Enter the email on your WALLORA account. We’ll send a secure link that expires in 60 minutes.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={C.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {sent ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle-outline" size={22} color={C.success} />
              <Text style={styles.successTitle}>Check your email</Text>
              <Text style={styles.successCopy}>
                If that address belongs to an account, a reset link is on its way.
              </Text>
              <Pressable onPress={() => router.replace("/auth/login")} style={styles.button}>
                <Text style={styles.buttonText}>Back to sign in</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setError(null);
                  }}
                  placeholder="you@example.com"
                  placeholderTextColor={C.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>

              <Pressable
                onPress={submit}
                disabled={loading}
                style={[styles.button, loading && { opacity: 0.6 }]}
              >
                {loading ? (
                  <ActivityIndicator color={C.bg} />
                ) : (
                  <Text style={styles.buttonText}>Send reset link</Text>
                )}
              </Pressable>

              <Pressable onPress={() => router.back()} style={styles.backLink}>
                <Text style={styles.backLinkText}>Back to sign in</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 24, paddingTop: 36 },
  mark: {
    width: 56,
    height: 56,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: { fontSize: 25, fontWeight: "800", color: C.text },
  copy: { fontSize: 13, lineHeight: 20, color: C.muted, marginTop: 8 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: R.md,
    backgroundColor: "rgba(228,111,117,0.1)",
    borderWidth: 1,
    borderColor: C.error,
    marginTop: 18,
  },
  errorText: { color: C.error, fontSize: 13, flex: 1 },
  field: { marginTop: 24 },
  label: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  input: {
    backgroundColor: C.card,
    color: C.text,
    borderRadius: R.md,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: C.border,
  },
  button: {
    backgroundColor: C.accent,
    paddingVertical: 15,
    borderRadius: R.md,
    alignItems: "center",
    marginTop: 22,
  },
  buttonText: { color: C.bg, fontWeight: "800", fontSize: 15 },
  backLink: { marginTop: 18, alignItems: "center" },
  backLinkText: { color: C.muted, fontSize: 13, textDecorationLine: "underline" },
  successBox: {
    marginTop: 24,
    padding: 18,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: "center",
  },
  successTitle: { color: C.text, fontSize: 17, fontWeight: "800", marginTop: 10 },
  successCopy: { color: C.muted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 6 },
});
