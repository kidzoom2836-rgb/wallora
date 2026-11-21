"use client";

import { create } from "zustand";

type AdminState = {
  open: boolean;
  openAdmin: () => void;
  setOpen: (open: boolean) => void;
};

/**
 * Controls visibility of the global Admin Dashboard overlay. Mounted once at
 * the root and toggled from the user menu (admin/super_admin only). The
 * component itself re-verifies the session role before rendering content.
 */
export const useAdminPanel = create<AdminState>((set) => ({
  open: false,
  openAdmin: () => set({ open: true }),
  setOpen: (open) => set({ open }),
}));
