import { db } from "@/lib/db";
import {
  isExpoPushToken,
  listPushEnabledUserIds,
  removeInvalidTokens,
  resolveEnabledTokens,
} from "./store";

/**
 * Expo Push Service sender. Uses the documented HTTPS API directly so no
 * additional server dependency is required. EXPO_ACCESS_TOKEN is optional
 * until push security is enabled in the Expo dashboard.
 */

const PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const MAX_BATCH = 100;

export type PushData = Record<string, string | number | boolean | null>;

export type PushPayload = {
  title: string;
  body: string;
  data?: PushData;
  sound?: "default";
  priority?: "default" | "normal" | "high";
  channelId?: string;
};

type ExpoTicket = {
  status?: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

export type SendResult = {
  attempted: number;
  accepted: number;
  invalidTokens: string[];
  errors: string[];
};

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const token = process.env.EXPO_ACCESS_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function sendBatch(
  messages: Array<{ to: string } & PushPayload>,
): Promise<{ accepted: number; invalidTokens: string[]; errors: string[] }> {
  const res = await fetch(PUSH_ENDPOINT, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(messages),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => ({}))) as {
    data?: ExpoTicket[] | ExpoTicket;
    errors?: { code?: string; message?: string }[];
  };

  if (!res.ok) {
    const detail = json.errors?.map((e) => e.message ?? e.code).filter(Boolean).join("; ");
    return {
      accepted: 0,
      invalidTokens: [],
      errors: [detail || `Expo push API returned ${res.status}.`],
    };
  }

  const tickets = Array.isArray(json.data)
    ? json.data
    : json.data
      ? [json.data]
      : [];
  const invalidTokens: string[] = [];
  const errors: string[] = [];

  tickets.forEach((ticket, index) => {
    if (ticket.status === "ok") return;
    if (ticket.details?.error === "DeviceNotRegistered" && messages[index]?.to) {
      invalidTokens.push(messages[index].to);
      return;
    }
    errors.push(ticket.message ?? "Expo rejected a notification.");
  });

  return {
    accepted: tickets.filter((ticket) => ticket.status === "ok").length,
    invalidTokens,
    errors: Array.from(new Set(errors)),
  };
}

/** Send one payload to already-resolved Expo tokens, in safe batches. */
export async function sendExpoPush(
  tokens: string[],
  payload: PushPayload,
): Promise<SendResult> {
  const clean = Array.from(new Set(tokens.filter(isExpoPushToken)));
  const result: SendResult = {
    attempted: clean.length,
    accepted: 0,
    invalidTokens: [],
    errors: [],
  };
  if (!clean.length) return result;

  const message: PushPayload = {
    channelId: "default",
    sound: "default",
    priority: "high",
    ...payload,
  };

  for (let i = 0; i < clean.length; i += MAX_BATCH) {
    const chunk = clean.slice(i, i + MAX_BATCH);
    try {
      const batch = await sendBatch(chunk.map((to) => ({ to, ...message })));
      result.accepted += batch.accepted;
      result.invalidTokens.push(...batch.invalidTokens);
      result.errors.push(...batch.errors);
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Expo push request failed.");
    }
  }

  result.errors = Array.from(new Set(result.errors));
  if (result.invalidTokens.length) {
    await removeInvalidTokens(result.invalidTokens).catch(() => {});
  }
  return result;
}

/** Send to WALLORA users, skipping anyone who has since disabled push. */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<SendResult> {
  const byUser = await resolveEnabledTokens(userIds);
  const tokens = Array.from(byUser.values()).flat();
  return sendExpoPush(tokens, payload);
}

/** Send to every account that has opted in and registered a device token. */
export async function broadcastPush(payload: PushPayload): Promise<SendResult> {
  const userIds = await listPushEnabledUserIds();
  return sendPushToUsers(userIds, payload);
}

/**
 * Fan-out when an admin approves a wallpaper: tell the creator it is live and
 * notify their followers. Failures are returned, never thrown, so moderation
 * can finish even when Expo is unreachable.
 */
export async function notifyNewWallpaper(input: {
  wallpaperId: string;
  title: string;
  slug: string;
  creatorId: string;
  creatorName?: string | null;
}): Promise<SendResult> {
  const followers = await db.follow.findMany({
    where: { followingId: input.creatorId },
    select: { followerId: true },
  });
  const recipients = Array.from(
    new Set([input.creatorId, ...followers.map((f) => f.followerId)]),
  );
  const name = input.creatorName?.trim() || "A WALLORA creator";

  return sendPushToUsers(recipients, {
    title: "New wallpaper is live",
    body: `${name} published “${input.title}”. Tap to view it in Discover.`,
    data: {
      type: "new_wallpaper",
      wallpaperId: input.wallpaperId,
      url: `/wallpaper/${input.slug}`,
    },
  });
}

/** Individual completion alert for AI Studio generations. */
export async function notifyGenerationComplete(input: {
  userId: string;
  generationId: string;
  prompt: string;
}): Promise<SendResult> {
  return sendPushToUsers([input.userId], {
    title: "Your artwork is ready",
    body: `Aurora finished ${input.prompt.slice(0, 72)}${input.prompt.length > 72 ? "…" : ""}`,
    data: {
      type: "generation_complete",
      generationId: input.generationId,
      url: "/studio",
    },
  });
}
