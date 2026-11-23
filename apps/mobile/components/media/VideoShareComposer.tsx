import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { apiJson } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { C, R } from "../../lib/theme";
import { withVerification } from "../../lib/verification";

type SharedVideo = {
  id: string;
  title: string;
  uri: string;
  source?: string;
};

/** Composer opened from the full-screen WALLORA video player. */
export function VideoShareComposer({
  video,
  onPosted,
}: {
  video: SharedVideo;
  onPosted: () => void;
}) {
  const { user } = useAuth();
  const [body, setBody] = useState(`Watching ${video.title} on WALLORA Player!`);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: "error" | "success" | "info" } | null>(null);

  const submit = async () => {
    if (busy) return;
    if (!user) {
      setNotice({ message: "Sign in to share videos with the community.", tone: "info" });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const posted = await withVerification(async () => {
        await apiJson("/api/v1/community/posts", {
          method: "POST",
          body: JSON.stringify({
            body: body.trim() || `Watching ${video.title} on WALLORA Player!`,
            kind: "text",
            refId: video.id,
            channelName: video.title,
            channelGroup: "WALLORA Video Player",
            previewUrl: null,
            streamUrl: video.uri,
            videoUrl: null,
            durationSec: null,
          }),
        });
        return true;
      });
      if (posted) {
        setNotice({ message: "Video shared to the community.", tone: "success" });
        setBody("");
        onPosted();
      } else {
        setNotice({ message: "Claim your free WALLORA tick to post.", tone: "info" });
      }
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Could not publish this share.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.mark}>
          <Ionicons name="film-outline" size={18} color={C.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>SHARE FROM PLAYER</Text>
          <Text style={styles.title} numberOfLines={1}>
            {video.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            WALLORA Video Player · {video.source === "local" ? "On this device" : "Stream"}
          </Text>
        </View>
      </View>
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="What do you like about this video?"
        placeholderTextColor={C.muted}
        multiline
        maxLength={500}
        editable={!busy}
        style={styles.input}
      />
      {notice && (
        <View style={styles.notice}>
          <Ionicons
            name={notice.tone === "success" ? "checkmark-circle-outline" : "information-circle-outline"}
            size={14}
            color={notice.tone === "error" ? C.error : notice.tone === "success" ? C.success : C.blue}
          />
          <Text style={styles.noticeText}>{notice.message}</Text>
        </View>
      )}
      <Pressable onPress={() => void submit()} disabled={busy} style={[styles.button, busy && styles.buttonDisabled]}>
        {busy ? (
          <ActivityIndicator color={C.bg} size="small" />
        ) : (
          <>
            <Ionicons name="people-outline" size={15} color={C.bg} />
            <Text style={styles.buttonText}>Post to community</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.accent + "55",
    backgroundColor: C.accentDim,
    padding: 14,
    marginBottom: 14,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  mark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { color: C.accent, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: C.text, fontSize: 14, fontWeight: "800", marginTop: 2 },
  subtitle: { color: C.muted, fontSize: 10.5, marginTop: 2 },
  input: {
    minHeight: 68,
    textAlignVertical: "top",
    color: C.text,
    fontSize: 13,
    lineHeight: 19,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    padding: 11,
  },
  notice: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10 },
  noticeText: { color: C.textSoft, fontSize: 11, flex: 1 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: C.accent,
    borderRadius: R.md,
    paddingVertical: 12,
    marginTop: 10,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: C.bg, fontSize: 13, fontWeight: "800" },
});
