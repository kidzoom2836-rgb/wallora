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
import { useLocalSearchParams, useRouter } from "expo-router";

import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { apiJson } from "../../lib/api";
import { C, R } from "../../lib/theme";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token;
  const token = rawToken ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!token) {
      setError("This reset link is missing its token. Open the full link from your email.");
      return;
    }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Use at least 8 characters with both letters and numbers.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiJson<{ ok: boolean }>("/api/v1/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? "Could not update your password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Choose a new password" subtitle="Account recovery" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.mark}>
            <Ionicons name="lock-closed-outline" size={28} color={C.accent} />
          </View>
          <Text style={styles.title}>Secure your account</Text>
          <Text style={styles.copy}>
            Reset links expire after 60 minutes and can only be used once.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={C.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {done ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle-outline" size={24} color={C.success} />
              <Text style={styles.successTitle}>Password updated</Text>
              <Text style={styles.successCopy}>You can now sign in with your new password.</Text>
              <Pressable
                onPress={() => router.replace("/auth/login")}
                style={styles.button}
              >
                <Text style={styles.buttonText}>Sign in</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>New password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      setError(null);
                    }}
                    placeholder="At least 8 characters, letters + numbers"
                    placeholderTextColor={C.muted}
                    secureTextEntry={!showPassword}
                    autoComplete="new-password"
                    style={styles.passwordInput}
                  />
                  <Pressable
                    onPress={() => setShowPassword((value) => !value)}
                    hitSlop={10}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={C.muted}
                    />
                  </Pressable>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Confirm password</Text>
                <TextInput
                  value={confirm}
                  onChangeText={(value) => {
                    setConfirm(value);
                    setError(null);
                  }}
                  placeholder="Repeat your new password"
                  placeholderTextColor={C.muted}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
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
                  <Text style={styles.buttonText}>Update password</Text>
                )}
              </Pressable>

              <Pressable onPress={() => router.replace("/auth/login")} style={styles.backLink}>
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
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  passwordInput: { flex: 1, color: C.text, padding: 14, fontSize: 15 },
  eyeButton: { padding: 14 },
  button: {
    backgroundColor: C.accent,
    paddingVertical: 15,
    borderRadius: R.md,
    alignItems: "center",
    marginTop: 26,
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
