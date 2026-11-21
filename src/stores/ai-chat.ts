"use client";

import { create } from "zustand";

import { DEFAULT_MODE_ID } from "@/lib/ai/modes";

type AiChatState = {
  open: boolean;
  conversationId: string | null;
  mode: string;
  openChat: () => void;
  closeChat: () => void;
  setConversationId: (id: string | null) => void;
  setMode: (mode: string) => void;
};

export const useAiChat = create<AiChatState>((set) => ({
  open: false,
  conversationId: null,
  mode: DEFAULT_MODE_ID,
  openChat: () => set({ open: true }),
  closeChat: () => set({ open: false }),
  setConversationId: (conversationId) => set({ conversationId }),
  setMode: (mode) => set({ mode }),
}));
