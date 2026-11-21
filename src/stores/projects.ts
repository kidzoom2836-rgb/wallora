"use client";

import { create } from "zustand";

/**
 * WALLORA Creative Projects panel state.
 *
 * Controls the full-screen projects overlay (open / close) and the
 * currently-selected project id (null = sidebar empty state).
 *
 * Mount the panel once in page.tsx; open it from anywhere via
 * `useProjects((s) => s.openPanel)`.
 */
type ProjectsState = {
  open: boolean;
  selectedProjectId: string | null;
  openPanel: () => void;
  setOpen: (open: boolean) => void;
  setSelectedProjectId: (id: string | null) => void;
};

export const useProjects = create<ProjectsState>((set) => ({
  open: false,
  selectedProjectId: null,
  openPanel: () => set({ open: true }),
  setOpen: (open) => set({ open }),
  setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),
}));
