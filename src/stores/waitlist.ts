"use client";

import { create } from "zustand";

export type WaitlistIntent = "creator" | "explorer" | "studio" | "general";

type WaitlistDialogState = {
  open: boolean;
  intent: WaitlistIntent;
  prompt: string;
  setOpen: (open: boolean) => void;
  openWith: (intent?: WaitlistIntent, prompt?: string) => void;
};

/**
 * Lightweight client store coordinating the global waitlist dialog.
 * Any CTA across the landing page can call `openWith(intent, prompt)` without
 * having to thread state through props.
 */
export const useWaitlistDialog = create<WaitlistDialogState>((set) => ({
  open: false,
  intent: "general",
  prompt: "",
  setOpen: (open) => set({ open }),
  openWith: (intent = "general", prompt = "") => set({ open: true, intent, prompt }),
}));
