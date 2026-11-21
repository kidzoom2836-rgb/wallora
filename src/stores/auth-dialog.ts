"use client";

import { create } from "zustand";

export type AuthView = "signin" | "register";

type AuthDialogState = {
  open: boolean;
  view: AuthView;
  openSignIn: () => void;
  openRegister: () => void;
  switchView: (view: AuthView) => void;
  setOpen: (open: boolean) => void;
};

/**
 * Coordinates the auth dialogs (sign-in / register) across the landing page.
 * The header, hero CTAs and footer can all trigger these without prop drilling.
 */
export const useAuthDialog = create<AuthDialogState>((set) => ({
  open: false,
  view: "signin",
  openSignIn: () => set({ open: true, view: "signin" }),
  openRegister: () => set({ open: true, view: "register" }),
  switchView: (view) => set({ view }),
  setOpen: (open) => set({ open }),
}));
