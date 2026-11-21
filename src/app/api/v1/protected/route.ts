import { NextResponse } from "next/server";

import { requireUser, requireRole, ROLES } from "@/lib/auth-helpers";

/**
 * GET /api/v1/protected/demo
 * A demonstration endpoint proving server-side auth works.
 * Returns the authenticated user's id and role.
 */
export async function GET() {
  const result = await requireUser();
  if (!result.ok) return result.response;

  return NextResponse.json({
    data: {
      message: "You are authenticated.",
      userId: result.session.user.id,
      role: result.session.user.role,
      username: result.session.user.username,
      email: result.session.user.email,
    },
  });
}

/**
 * GET /api/v1/protected/demo?admin=1
 * Requires the admin role — demonstrates role enforcement.
 * (No admin user exists by default, so this will return 403 until one is
 * provisioned. This is intentional and honest.)
 */
export async function GET_ADMIN() {
  const result = await requireRole(ROLES.ADMIN);
  if (!result.ok) return result.response;

  return NextResponse.json({
    data: {
      message: "You are an administrator.",
      userId: result.session.user.id,
    },
  });
}
