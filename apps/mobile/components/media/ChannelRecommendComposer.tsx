import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { apiJson } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import {
  captureChannelClip,
  type UploadedClip,
} from "../../lib/uploads";
import { groupLabel, type IptvChannel } from "../../lib/iptv";
import { withVerification } from "../../lib/verification";
import { C, R } from "../../lib/theme";

type Notice = { message: string; tone: "error" | "success" | "info" };

function isLegacyEnumError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /expected one of|invalid_option|channel_clip|invalid option/i.test(message);
}

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
  const [clip, setClip] = useState<UploadedClip | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const capture = async (): Promise<UploadedClip> => {
    setCapturing(true);
    setNotice(null);
    try {
      const captured = await captureChannelClip({
        channelId: channel.id,
        streamUrl: channel.url,
        durationSec: 9,
        userId: user?.id,
      });
      setClip(captured);
      return captured;
    } finally {
      setCapturing(false);
    }
  };

  const submit = async () => {
    if (busy || capturing) return;
    if (!user) {
      setNotice({ message: "Sign in to recommend channels to the community.", tone: "info" });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      // Capture is best-effort. A stale backend or a too-large/geo-blocked
      // segment must never stop the user from sharing the channel.
      let preview: UploadedClip | null = clip;
      try {
        preview = clip ?? (await capture());
      } catch (captureError) {
        setNotice({
          message:
            captureError instanceof Error && captureError.message
              ? `Sharing as a live channel link — ${captureError.message}`
              : "Sharing as a live channel link.",
          tone: "info",
        });
      }

      const bodyText = body.trim() || `Recommended ${channel.name}`;
      const clipUrl = preview?.videoUrl ?? channel.url;
      const postBody = {
        body: `${bodyText}\n9s live preview: ${clipUrl}`,
        channelId: channel.id,
        refId: channel.id,
        channelName: channel.name,
        channelGroup: channel.group,
        previewUrl: channel.logo ?? null,
        streamUrl: channel.url,
        ...(preview ? { videoUrl: preview.videoUrl } : {}),
        durationSec: 9,
      };

      const posted = await withVerification(async () => {
        try {
          await apiJson("/api/v1/community/posts", {
            method: "POST",
            body: JSON.stringify({ ...postBody, kind: "channel_clip" }),
          });
          return { legacy: false, captured: !!preview };
        } catch (error) {
          if (!isLegacyEnumError(error)) throw error;
          // Older deployed schemas reject `channel_clip`. The body already
          // carries the clip/live URL so WALLORA Reels can still play it.
          await apiJson("/api/v1/community/posts", {
            method: "POST",
            body: JSON.stringify({ ...postBody, kind: "text" }),
          });
          return { legacy: true, captured: !!preview };
        }
      });

      if (posted) {
        setNotice({
          message: posted.captured
            ? "9-second live preview posted to the community."
            : "Live channel posted — the clip will appear once the backend is updated.",
          tone: "success",
        });
        setBody("");
        setClip(null);
        onPosted();
      } else {
        setNotice({ message: "Claim your free WALLORA tick to post.", tone: "info" });
      }
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Could not publish this channel.",
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
            {groupLabel(channel.group)} · 9s captured from this channel
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
        editable={!busy && !capturing}
        style={styles.input}
      />

      <View style={styles.clipRow}>
        <View style={[styles.clipBadge, clip && styles.clipBadgeReady]}>
          <Ionicons
            name={clip ? "checkmark-circle" : capturing ? "radio-outline" : "videocam-outline"}
            size={14}
            color={clip ? C.success : C.accent}
          />
          <Text style={[styles.clipBadgeText, clip && styles.clipBadgeTextReady]} numberOfLines={1}>
            {capturing
              ? "Capturing 9s from live stream…"
              : clip
                ? "Live preview ready"
                : "Preview captured on post"}
          </Text>
        </View>
        {!capturing && !busy ? (
          <Pressable onPress={() => void capture()} style={styles.recapture}>
            <Text style={styles.recaptureText}>Recapture</Text>
          </Pressable>
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

      <Pressable
        onPress={() => void submit()}
        disabled={busy || capturing}
        style={[styles.button, (busy || capturing) && styles.buttonDisabled]}
      >
        {busy || capturing ? (
          <ActivityIndicator color={C.bg} size="small" />
        ) : (
          <>
            <Ionicons name="send" size={15} color={C.bg} />
            <Text style={styles.buttonText}>Post 9s live clip</Text>
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
  clipBadge: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: C.accent + "55",
    borderRadius: R.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  clipBadgeReady: { borderColor: C.success + "66", backgroundColor: C.successDim },
  clipBadgeText: { color: C.accent, fontSize: 11, fontWeight: "700", flex: 1 },
  clipBadgeTextReady: { color: C.success },
  recapture: { paddingHorizontal: 8, paddingVertical: 8 },
  recaptureText: { color: C.textSoft, fontSize: 10.5, fontWeight: "700" },
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
