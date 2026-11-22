import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getTiersForUsers } from "@/lib/verification/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/products/mine
 *
 * Every listing owned by the signed-in creator, including unpublished drafts,
 * with the live completed purchase count. Powers /marketplace/manage.
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const products = await db.product.findMany({
    where: { creatorId: auth.session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      license: true,
      coverUrl: true,
      isPublished: true,
      createdAt: true,
      updatedAt: true,
      purchases: { where: { status: "completed" }, select: { id: true } },
    },
  });

  const tiers = await getTiersForUsers([auth.session.user.id]);
  return NextResponse.json({
    data: {
      items: products.map(({ purchases, ...product }) => ({
        ...product,
        purchaseCount: purchases.length,
        tier: tiers[auth.session.user.id] ?? "free",
      })),
    },
  });
}
