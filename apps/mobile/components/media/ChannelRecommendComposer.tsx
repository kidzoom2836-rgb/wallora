import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiJson } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { pickChannelClip, uploadChannelClip, type PickedClip } from "../../lib/uploads";
import { groupLabel, type IptvChannel } from "../../lib/iptv";
import { withVerification } from "../../lib/verification";
import { C, R } from "../../lib/theme";

/** Composer used when a user taps "Recommend" on a live TV channel. */
export function ChannelRecommendComposer({
  channel,
  onPosted,
}: {
  channel: IptvChannel;
  onPosted: () => void;
}) {
  const { user } = useAuth();
  const [body, setBody] = useState(`You have to see ${channel.name} on WALLORA TV!`);
  const [clip, setClip] = useState<PickedClip | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: "error" | "success" | "info" } | null>(null);

  const attachClip = async () => {
    setNotice(null);
    try {
      const picked = await pickChannelClip();
      if (picked) setClip(picked);
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Could not attach that video.",
        tone: "error",
      });
    }
  };

  const submit = async () => {
    if (busy) return;
    if (!user) {
      setNotice({ message: "Sign in to recommend channels to the community.", tone: "info" });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const posted = await withVerification(async () => {
        const uploaded = clip ? await uploadChannelClip(clip) : null;
        await apiJson("/api/v1/community/posts", {
          method: "POST",
          body: JSON.stringify({
            body: body.trim() || `Recommended ${channel.name}`,
            kind: "channel_clip",
            channelId: channel.id,
            refId: channel.id,
            channelName: channel.name,
            channelGroup: channel.group,
            previewUrl: channel.logo ?? null,
            streamUrl: channel.url,
            videoUrl: uploaded?.videoUrl ?? null,
            durationSec: 9,
          }),
        });
        return true;
      });
      if (posted) {
        setNotice({ message: "Channel recommended to the community.", tone: "success" });
        setBody("");
        setClip(null);
        onPosted();
      } else {
        setNotice({ message: "Claim your free WALLORA tick to post.", tone: "info" });
      }
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Could not publish this recommendation.",
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
          <Ionicons name="tv-outline" size={18} color={C.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>RECOMMEND TO COMMUNITY</Text>
          <Text style={styles.title} numberOfLines={1}>
            {channel.name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {groupLabel(channel.group)} · 9-second preview
          </Text>
        </View>
      </View>

      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Why should people watch this channel?"
        placeholderTextColor={C.muted}
        multiline
        maxLength={500}
        editable={!busy}
        style={styles.input}
      />

      <View style={styles.clipRow}>
        <Pressable onPress={() => void attachClip()} disabled={busy} style={styles.clipButton}>
          <Ionicons name="videocam-outline" size={15} color={C.accent} />
          <Text style={styles.clipButtonText}>
            {clip ? "Change 9s clip" : "Attach a 9s video (optional)"}
          </Text>
        </Pressable>
        {clip ? (
          <Text style={styles.clipName} numberOfLines={1}>
            {clip.fileName}
          </Text>
        ) : null}
      </View>

      {notice ? (
        <View style={styles.notice}>
          <Ionicons
            name={notice.tone === "success" ? "checkmark-circle-outline" : "information-circle-outline"}
            size={14}
            color={notice.tone === "error" ? C.error : notice.tone === "success" ? C.success : C.blue}
          />
          <Text style={styles.noticeText}>{notice.message}</Text>
        </View>
      ) : null}

      <Pressable onPress={() => void submit()} disabled={busy} style={[styles.button, busy && styles.buttonDisabled]}>
        {busy ? (
          <ActivityIndicator color={C.bg} size="small" />
        ) : (
          <>
            <Ionicons name="send" size={15} color={C.bg} />
            <Text style={styles.buttonText}>Post recommendation</Text>
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
    minHeight: 70,
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
  clipRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 9 },
  clipButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: C.accent + "55",
    borderRadius: R.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  clipButtonText: { color: C.accent, fontSize: 11, fontWeight: "700" },
  clipName: { flex: 1, color: C.muted, fontSize: 10 },
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
