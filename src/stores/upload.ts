"use client";

import { create } from "zustand";

type UploadDialogState = {
  open: boolean;
  openUpload: () => void;
  setOpen: (open: boolean) => void;
};

export const useUploadDialog = create<UploadDialogState>((set) => ({
  open: false,
  openUpload: () => set({ open: true }),
  setOpen: (open) => set({ open }),
}));
