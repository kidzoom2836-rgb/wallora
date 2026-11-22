// Shared design tokens. Mirrored in CSS variables in apps/web.

export const colors = {
  background: "#0B0C0F",
  surface: "#14161B",
  raisedSurface: "#1C1F26",
  foreground: "#F7F7F5",
  secondaryText: "#9296A1",
  primaryAccent: "#D7B879",
  border: "#292C33",
  success: "#43B581",
  error: "#E46F75",
} as const;

export const radii = {
  sm: "0.375rem",
  md: "0.625rem",
  lg: "0.875rem",
  xl: "1.25rem",
} as const;

export const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  xxl: "3rem",
} as const;
