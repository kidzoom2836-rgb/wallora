import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";

/**
 * GET /api/v1/products
 *
 * Lists published marketplace products.
 *
 * Query params:
 *   page    — 1-based page number (default 1)
 *   limit   — items per page (default 12, max 24)
 *   creator — filter by creator username (e.g. "wallora")
 *
 * Response:
 *   { data: { items: Product[], pagination: {...} } }
 *
 * Each item includes the creator profile (username, displayName, verified)
 * and the live purchase count (number of completed purchases).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(24, Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10) || 12));
  const creator = searchParams.get("creator")?.trim() ?? "";

  const where: Record<string, unknown> = {
    isPublished: true,
  };
  if (creator) {
    where.creator = { profile: { username: creator } };
  }

  const [total, items] = await Promise.all([
    db.product.count({ where: where as never }),
    db.product.findMany({
      where: where as never,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        license: true,
        coverUrl: true,
        createdAt: true,
        creator: {
          select: {
            id: true,
            profile: {
              select: { username: true, displayName: true, verified: true },
            },
          },
        },
        purchases: {
          where: { status: "completed" },
          select: { id: true },
        },
      },
    }),
  ]);

  const data = items.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    price: p.price,
    license: p.license,
    coverUrl: p.coverUrl,
    createdAt: p.createdAt,
    creator: {
      id: p.creator.id,
      username: p.creator.profile?.username ?? null,
      displayName: p.creator.profile?.displayName ?? null,
      verified: p.creator.profile?.verified ?? false,
    },
    purchaseCount: p.purchases.length,
  }));

  return NextResponse.json({
    data: {
      items: data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    },
  });
}
