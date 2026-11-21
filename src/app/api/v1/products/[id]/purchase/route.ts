import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";

/**
 * POST /api/v1/products/[id]/purchase
 *
 * Simplified demo purchase flow. No real payment provider is wired up — this
 * endpoint records a Purchase row with status="completed" so the storefront
 * can demonstrate the entitlement flow end-to-end.
 *
 * Rules:
 *   - Auth required (401 if no session).
 *   - Product must exist and be published (404 otherwise).
 *   - Idempotent: if the user already owns the product (any status), return
 *     the existing purchase with HTTP 200 instead of creating a duplicate.
 *   - Otherwise create the purchase at status="completed" and return 201.
 *
 * The response always carries a `demo` note so the client can surface an
 * honest message to the user that no real payment was processed.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const { id } = await params;
  const userId = result.session.user.id;

  // Load the product — must exist and be published.
  const product = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      price: true,
      isPublished: true,
      creatorId: true,
    },
  });

  if (!product || !product.isPublished) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Product not found or not available." } },
      { status: 404 },
    );
  }

  // Creators cannot "purchase" their own product — return the existing
  // entitlement (or a 409 if they somehow don't have one) rather than
  // creating a self-purchase row.
  if (product.creatorId === userId) {
    return NextResponse.json(
      {
        error: {
          code: "own_product",
          message: "You cannot purchase your own product. It is already in your library.",
        },
      },
      { status: 409 },
    );
  }

  // Check for an existing purchase (any status — unique constraint on
  // [userId, productId]).
  const existing = await db.purchase.findUnique({
    where: { userId_productId: { userId, productId: id } },
    select: {
      id: true,
      userId: true,
      productId: true,
      price: true,
      status: true,
      createdAt: true,
    },
  });

  if (existing) {
    // Idempotent — return the existing purchase with 200.
    return NextResponse.json({
      data: {
        purchase: {
          id: existing.id,
          userId: existing.userId,
          productId: existing.productId,
          price: existing.price,
          status: existing.status,
          createdAt: existing.createdAt,
        },
        alreadyOwned: true,
        demo: {
          note: "Demo purchase flow — no real payment was processed. This purchase is recorded as completed for evaluation purposes only.",
          paymentProvider: null as string | null,
        },
      },
    });
  }

  // Create the purchase at status="completed" — honest demo: no payment
  // gateway, marked completed so the entitlement flow can be demonstrated.
  const purchase = await db.purchase.create({
    data: {
      userId,
      productId: id,
      price: product.price,
      status: "completed",
    },
    select: {
      id: true,
      userId: true,
      productId: true,
      price: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    {
      data: {
        purchase: {
          id: purchase.id,
          userId: purchase.userId,
          productId: purchase.productId,
          price: purchase.price,
          status: purchase.status,
          createdAt: purchase.createdAt,
        },
        alreadyOwned: false,
        demo: {
          note: "Demo purchase flow — no real payment was processed. This purchase is recorded as completed for evaluation purposes only.",
          paymentProvider: null as string | null,
        },
      },
    },
    { status: 201 },
  );
}
