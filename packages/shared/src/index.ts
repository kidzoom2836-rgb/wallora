// Shared utilities and types used across WALLORA apps and packages.
// Keep this package dependency-free where possible.

export type ID = string;

export type Timestamps = {
  createdAt: Date;
  updatedAt: Date;
};

export const APP_NAME = "WALLORA" as const;

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
