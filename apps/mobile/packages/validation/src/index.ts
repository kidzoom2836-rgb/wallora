import { z } from "zod";

// Shared Zod schemas. Domain-specific schemas live in their modules.
export const emailSchema = z.string().email();
export const usernameSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers and underscores");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
