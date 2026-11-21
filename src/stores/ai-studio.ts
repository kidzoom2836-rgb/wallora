"use client";

import { create } from "zustand";

type AiStudioState = {
  open: boolean;
  openStudio: () => void;
  setOpen: (open: boolean) => void;
};

export const useAiStudio = create<AiStudioState>((set) => ({
  open: false,
  openStudio: () => set({ open: true }),
  setOpen: (open) => set({ open }),
}));
