import { Alert } from "react-native";
import { apiJson } from "./api";

export interface VerificationState {
  tier: "free" | "verified" | "premium" | "supreme";
  claimed: boolean;
  limits?: Record<string, number>;
  perks?: Record<string, string | boolean>;
}

/**
 * WALLORA requires an authenticity acknowledgement before protected actions
 * (posting, commenting, uploading, AI chat). Free accounts claim a grey tick;
 * colored tiers are earned through admin review.
 */
export async function ensureVerification(): Promise<boolean> {
  let state: VerificationState;
  try {
    state = await apiJson<VerificationState>("/api/v1/verification/state");
  } catch {
    // If the state endpoint is unreachable, let the action proceed so the
    // server can return its own, more specific error.
    return true;
  }

  if (state.claimed) return true;

  return new Promise<boolean>((resolve) => {
    Alert.alert(
      "WALLORA authenticity",
      "Every account receives a free grey verification tick so the community knows posts come from a real WALLORA account. Blue, gold and supreme badges are reviewed by WALLORA admins. Claim your free tick to continue.",
      [
        {
          text: "Not now",
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: "Claim free tick",
          onPress: async () => {
            try {
              await apiJson("/api/v1/verification/claim", { method: "POST" });
              resolve(true);
            } catch {
              resolve(false);
            }
          },
        },
      ],
      { cancelable: true },
    );
  });
}

/** Run an action only after the verification acknowledgement is in place. */
export async function withVerification<T>(action: () => Promise<T>): Promise<T | undefined> {
  const ok = await ensureVerification();
  if (!ok) return undefined;
  return action();
}
