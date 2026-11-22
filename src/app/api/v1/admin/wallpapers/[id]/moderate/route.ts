import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireRole, ROLES } from "@/lib/auth-helpers";
import { hasVerification } from "@/lib/verification/store";

const ALLOWED_STATUSES = ["approved", "rejected", "flagged"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

/**
 * PATCH /api/v1/admin/wallpapers/[id]/moderate
 *
 * Update a wallpaper's moderation status. Admin-only. Each call appends a row
 * to the AuditLog so every moderation decision is traceable to an actor.
 *
 * Body: { status: "approved" | "rejected" | "flagged" }
 *
 * Returns the updated wallpaper record.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(ROLES.ADMIN);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Wallpaper id is required." } },
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

  const statusRaw =
    typeof body === "object" && body !== null && "status" in body
      ? (body as { status: unknown }).status
      : undefined;

  if (typeof statusRaw !== "string" || !ALLOWED_STATUSES.includes(statusRaw as AllowedStatus)) {
    return NextResponse.json(
      {
        error: {
          code: "bad_request",
          message: `status must be one of: ${ALLOWED_STATUSES.join(", ")}`,
        },
      },
      { status: 400 },
    );
  }
  const nextStatus = statusRaw as AllowedStatus;

  // Fetch the existing wallpaper so we can record the prior status in the
  // audit log metadata.
  const existing = await db.wallpaper.findUnique({
    where: { id },
    select: { id: true, status: true, title: true, slug: true, userId: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Wallpaper not found." } },
      { status: 404 },
    );
  }

  // A post may only go public when its creator holds at least the free
  // verification tier. Every account gets free automatically, but this keeps
  // the publish boundary explicit for future (email/blue) requirements.
  if (nextStatus === "approved" && !(await hasVerification(existing.userId))) {
    return NextResponse.json(
      {
        error: {
          code: "verification_required",
          message: "Creator must hold at least free verification before this post can go public.",
        },
      },
      { status: 403 },
    );
  }

  const updated = await db.wallpaper.update({
    where: { id },
    // Approving must publish the upload. Uploads are created with BOTH
    // status:"pending" and isPublic:false — flipping only `status` left
    // approved uploads invisible in every public read path.
    data: {
      status: nextStatus,
      isPublic: nextStatus === "approved",
    },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      isPublic: true,
      updatedAt: true,
    },
  });

  await db.auditLog.create({
    data: {
      actorId: auth.session.user.id,
      action: `wallpaper.moderate:${nextStatus}`,
      targetType: "wallpaper",
      targetId: id,
      metadata: JSON.stringify({
        from: existing.status,
        to: nextStatus,
        title: existing.title,
        slug: existing.slug,
      }),
    },
  });

  return NextResponse.json({ data: updated });
}
