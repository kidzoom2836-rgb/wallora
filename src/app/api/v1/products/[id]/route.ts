import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth-helpers";

/**
 * GET /api/v1/products/[id]
 *
 * Returns the full product detail for a published product, including the
 * creator profile and the live purchase count. If the authenticated user
 * already owns the product, an `owned` flag is included so the UI can swap
 * the "Purchase" button for "Owned".
 *
 * Returns 404 if the product does not exist or is not published.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getAuthSession();
  const userId = session?.user?.id;

  const product = await db.product.findUnique({
    where: { id },
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
      creator: {
        select: {
          id: true,
          profile: {
            select: {
              username: true,
              displayName: true,
              verified: true,
              bio: true,
              avatarUrl: true,
            },
          },
        },
      },
      purchases: {
        where: { status: "completed" },
        select: {
          id: true,
          userId: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  if (!product || !product.isPublished) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Product not found or not available." } },
      { status: 404 },
    );
  }

  const owned = userId
    ? product.purchases.some((p) => p.userId === userId)
    : false;

  const ownPurchase = userId
    ? product.purchases.find((p) => p.userId === userId)
    : null;

  return NextResponse.json({
    data: {
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      license: product.license,
      coverUrl: product.coverUrl,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      creator: {
        id: product.creator.id,
        username: product.creator.profile?.username ?? null,
        displayName: product.creator.profile?.displayName ?? null,
        verified: product.creator.profile?.verified ?? false,
        bio: product.creator.profile?.bio ?? null,
        avatarUrl: product.creator.profile?.avatarUrl ?? null,
      },
      purchaseCount: product.purchases.length,
      owned,
      ...(ownPurchase
        ? {
            purchase: {
              id: ownPurchase.id,
              status: ownPurchase.status,
              createdAt: ownPurchase.createdAt,
            },
          }
        : {}),
    },
  });
}
