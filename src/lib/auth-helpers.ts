import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { VerificationTier } from "@/lib/verification/store";

/**
 * WALLORA server-side authorization primitives.
 *
 * Rule (spec PART 15): roles are enforced on the server. The client never
 * grants roles. Every protected resource checks authorization here.
 */

export const ROLES = {
  GUEST: "guest",
  USER: "user",
  CREATOR: "creator",
  MODERATOR: "moderator",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

const ROLE_HIERARCHY: Record<string, number> = {
  guest: 0,
  user: 1,
  creator: 2,
  moderator: 3,
  admin: 4,
  super_admin: 5,
};

/** True if `actorRole` satisfies the required role (hierarchical). */
export function hasRole(actorRole: string | undefined, required: Role): boolean {
  if (!actorRole) return false;
  const actorLevel = ROLE_HIERARCHY[actorRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[required] ?? 99;
  return actorLevel >= requiredLevel;
}

/** Returns the current session (or null) — never throws. */
export async function getAuthSession() {
  try {
    return await getServerSession(authOptions);
  } catch {
    return null;
  }
}

/**
 * Require an authenticated, active user. Returns either the user or a 401
 * NextResponse suitable for returning from a route handler.
 */
export async function requireUser() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: { code: "unauthorized", message: "Authentication required." } },
        { status: 401 },
      ),
    };
  }
  return { ok: true as const, session };
}

/** Require a user with at least the given role. */
export async function requireRole(required: Role) {
  const result = await requireUser();
  if (!result.ok) return result;

  if (!hasRole(result.session.user.role, required)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: {
            code: "forbidden",
            message: "You do not have permission to perform this action.",
          },
        },
        { status: 403 },
      ),
    };
  }
  return result;
}

/**
 * Require at least baseline (free) verification.
 *
 * Every active account receives the free grey tick automatically, so this is
 * a consistent enforcement point across posting, following, chat and projects.
 * It becomes a real gate the day email verification is introduced.
 */
export async function requireVerification(minimum: VerificationTier = "free") {
  const result = await requireUser();
  if (!result.ok) return result;

  const { hasVerification } = await import("@/lib/verification/store");
  if (!(await hasVerification(result.session.user.id, minimum))) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: {
            code: "verification_required",
            message:
              minimum === "free"
                ? "Verify your free account to continue."
                : `A ${minimum} badge is required for this action.`,
          },
        },
        { status: 403 },
      ),
    };
  }
  return result;
}

/** Hash a password for storage. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/** Constant-time password verification. */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Validate a username for registration (lowercase, alphanumeric + dash). */
export function isValidUsername(username: string): boolean {
  return /^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/.test(username) &&
    !/--/.test(username);
}

/** Check a username is not reserved / already taken. */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const existing = await db.profile.findUnique({
    where: { username },
    select: { id: true },
  });
  return !existing;
}
