// Domain primitives and business rules shared between web, mobile and worker.
// Populated in later phases.

export type UserRole = "guest" | "user" | "creator" | "moderator" | "admin" | "super_admin";

export type ModerationStatus = "pending" | "approved" | "rejected" | "flagged" | "removed";

export type AiGenerationStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";
