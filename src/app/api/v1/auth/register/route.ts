import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  hashPassword,
  isValidUsername,
  isUsernameAvailable,
  ROLES,
} from "@/lib/auth-helpers";

/**
 * POST /api/v1/auth/register
 *
 * Creates a WALLORA user + profile + default settings atomically.
 * Passwords are hashed with bcrypt (cost 12). On success, any matching
 * waitlist entry is linked to the new user.
 */
const RESERVED_USERNAMES = new Set([
  "admin", "root", "wallora", "support", "help", "api",
  "settings", "profile", "dashboard", "auth", "login",
  "register", "about", "legal", "terms", "privacy",
]);

const RegisterSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, { message: "Display name must be at least 2 characters" })
    .max(60, { message: "Display name is too long" }),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, { message: "Username must be at least 3 characters" })
    .max(32, { message: "Username is too long" })
    .refine(isValidUsername, {
      message: "Use lowercase letters, numbers and dashes only. Must start and end with a letter or number.",
    })
    .refine((v) => !RESERVED_USERNAMES.has(v), {
      message: "This username is reserved.",
    }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(5, { message: "Email is required" })
    .email({ message: "Enter a valid email address" })
    .max(254, { message: "Email is too long" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(128, { message: "Password is too long" })
    .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), {
      message: "Password must include both letters and numbers",
    }),
  acceptTerms: z
    .boolean()
    .refine((v) => v === true, {
      message: "You must accept the Terms of Service and Privacy Policy",
    }),
});

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "validation_error", "Request body must be valid JSON.");
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return errorResponse(
      400,
      "validation_error",
      firstError?.message ?? "Invalid request.",
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }

  const { displayName, username, email, password } = parsed.data;

  // Username availability (extra check beyond the reserved list).
  const usernameTaken = !(await isUsernameAvailable(username));
  if (usernameTaken) {
    return errorResponse(409, "conflict", "This username is already taken.");
  }

  const passwordHash = await hashPassword(password);

  try {
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: displayName,
          passwordHash,
          role: ROLES.USER,
          status: "active",
        },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      });

      const profile = await tx.profile.create({
        data: {
          userId: user.id,
          username,
          displayName,
        },
        select: { id: true, username: true },
      });

      await tx.userSettings.create({
        data: { userId: user.id },
      });

      // Link an existing waitlist entry (by email) to this new user, if any.
      await tx.waitlistEntry.updateMany({
        where: { email },
        data: { userId: user.id },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "auth.register",
          targetType: "user",
          targetId: user.id,
          metadata: JSON.stringify({ username }),
        },
      });

      return { user, profile };
    });

    return NextResponse.json(
      {
        data: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          username: result.profile.username,
          createdAt: result.user.createdAt,
        },
        message: "Your WALLORA account is ready. You can now sign in.",
      },
      { status: 201 },
    );
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Unique constraint violation — figure out which field.
      const target = (err.meta as { target?: string[] })?.target?.[0] ?? "email";
      const message =
        target === "email"
          ? "An account with this email already exists."
          : target === "username"
            ? "This username is already taken."
            : "This value is already in use.";
      return errorResponse(409, "conflict", message);
    }
    console.error("[register] failed:", err);
    return errorResponse(500, "server_error", "Could not create your account. Please try again.");
  }
}
