import { NextRequest, NextResponse } from "next/server";

import { requireRole, ROLES } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

/**
 * PATCH /api/v1/admin/users/[id]
 *
 * Super-admin only. Manages the official/verified creator account:
 * role, account status, profile verification and creator status.
 *
 * NOTE: role changes are stored in the DB immediately, but only take effect
 * for that user's existing session after they sign out and back in (roles
 * are copied into the JWT at sign-in).
 */

const ALLOWED_ROLES = ["guest", "user", "creator", "moderator", "admin", "super_admin"];
const ALLOWED_STATUS = ["active", "suspended", "deleted"];
const ALLOWED_CREATOR = ["none", "pending", "approved", "rejected"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(ROLES.SUPER_ADMIN);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "User id is required." } },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (b.role !== undefined) {
    if (typeof b.role !== "string" || !ALLOWED_ROLES.includes(b.role)) {
      return NextResponse.json(
        { error: { code: "bad_request", message: `role must be one of: ${ALLOWED_ROLES.join(", ")}` } },
        { status: 400 },
      );
    }
    data.role = b.role;
  }

  if (b.status !== undefined) {
    if (typeof b.status !== "string" || !ALLOWED_STATUS.includes(b.status)) {
      return NextResponse.json(
        { error: { code: "bad_request", message: `status must be one of: ${ALLOWED_STATUS.join(", ")}` } },
        { status: 400 },
      );
    }
    data.status = b.status;
  }

  const profileData: Record<string, unknown> = {};
  if (b.verified !== undefined) {
    if (typeof b.verified !== "boolean") {
      return NextResponse.json(
        { error: { code: "bad_request", message: "verified must be a boolean." } },
        { status: 400 },
      );
    }
    profileData.verified = b.verified;
  }
  if (b.creatorStatus !== undefined) {
    if (typeof b.creatorStatus !== "string" || !ALLOWED_CREATOR.includes(b.creatorStatus)) {
      return NextResponse.json(
        { error: { code: "bad_request", message: `creatorStatus must be one of: ${ALLOWED_CREATOR.join(", ")}` } },
        { status: 400 },
      );
    }
    profileData.creatorStatus = b.creatorStatus;
  }

  if (Object.keys(data).length === 0 && Object.keys(profileData).length === 0) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "No updatable fields provided." } },
      { status: 400 },
    );
  }

  const existing = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, status: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: { code: "not_found", message: "User not found." } },
      { status: 404 },
    );
  }

  // Guard: never let the last super admin demote themselves.
  if (
    existing.role === "super_admin" &&
    auth.session.user.id === id &&
    data.role && data.role !== "super_admin"
  ) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "You cannot demote your own super_admin account." } },
      { status: 403 },
    );
  }

  const updated = await db.user.update({
    where: { id },
    data: {
      ...data,
      ...(Object.keys(profileData).length
        ? {
            profile: {
              upsert: {
                create: {
                  username: `v${id.slice(0, 24).toLowerCase()}`,
                  ...profileData,
                },
                update: profileData,
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      profile: {
        select: {
          username: true,
          displayName: true,
          verified: true,
          creatorStatus: true,
        },
      },
    },
  });

  await db.auditLog.create({
    data: {
      actorId: auth.session.user.id,
      action: `admin.user.update:${id}`,
      targetType: "user",
      targetId: id,
      metadata: JSON.stringify({ from: { role: existing.role, status: existing.status }, patch: { ...data, ...profileData } }),
    },
  });

  return NextResponse.json({ data: updated });
}
