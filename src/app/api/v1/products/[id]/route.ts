import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getAuthSession, requireUser, requireVerification } from "@/lib/auth-helpers";
import { getTiersForUsers } from "@/lib/verification/store";

const LICENSES = ["Personal", "Commercial", "Extended"] as const;

const PatchProductSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000),
  price: z.number().int().min(0).max(10_000_000),
  license: z.enum(LICENSES),
  coverUrl: z.string().trim().max(2048).nullable(),
  isPublished: z.boolean(),
}).partial().refine((body) => Object.keys(body).length > 0, { message: "No fields to update." });

function isSafeCoverUrl(value: string): boolean {
  if (!value || value.startsWith("//")) return false;
  return value.startsWith("/") || /^https?:\/\//i.test(value);
}

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

  const tiers = await getTiersForUsers([product.creator.id]);

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
        tier: tiers[product.creator.id] ?? "free",
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

/**
 * PATCH /api/v1/products/[id]
 *
 * Partial update of the caller's own listing. Non-owners receive 404 so the
 * existence of another creator's draft is never revealed.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireVerification();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await db.product.findUnique({
    where: { id },
    select: { creatorId: true },
  });
  if (!existing || existing.creatorId !== auth.session.user.id) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Product not found." } },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }
  const parsed = PatchProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: parsed.error.issues[0]?.message ?? "Invalid request.",
        },
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  if (input.coverUrl && !isSafeCoverUrl(input.coverUrl)) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Cover URL must be an http(s) or same-origin path." } },
      { status: 400 },
    );
  }

  const product = await db.product.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.license !== undefined ? { license: input.license } : {}),
      ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl || null } : {}),
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      license: true,
      coverUrl: true,
      isPublished: true,
      updatedAt: true,
      creator: {
        select: {
          id: true,
          profile: { select: { username: true, displayName: true, verified: true, avatarUrl: true } },
        },
      },
      purchases: { where: { status: "completed" }, select: { id: true } },
    },
  });

  const tiers = await getTiersForUsers([auth.session.user.id]);
  return NextResponse.json({
    data: {
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      license: product.license,
      coverUrl: product.coverUrl,
      isPublished: product.isPublished,
      updatedAt: product.updatedAt,
      purchaseCount: product.purchases.length,
      creator: {
        id: product.creator.id,
        username: product.creator.profile?.username ?? null,
        displayName: product.creator.profile?.displayName ?? null,
        verified: product.creator.profile?.verified ?? false,
        avatarUrl: product.creator.profile?.avatarUrl ?? null,
        tier: tiers[auth.session.user.id] ?? "free",
      },
    },
    message: "Listing updated.",
  });
}

/**
 * DELETE /api/v1/products/[id]
 *
 * Permanently removes the caller's listing and its purchase records.
 * Non-owners receive 404.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await db.product.findUnique({
    where: { id },
    select: { creatorId: true },
  });
  if (!existing || existing.creatorId !== auth.session.user.id) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Product not found." } },
      { status: 404 },
    );
  }

  await db.$transaction([
    db.purchase.deleteMany({ where: { productId: id } }),
    db.product.delete({ where: { id } }),
  ]);

  return NextResponse.json({
    data: { id, deleted: true },
    message: "Listing deleted.",
  });
}
