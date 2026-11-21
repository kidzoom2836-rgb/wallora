import { NextResponse } from "next/server";

import { db } from "@/lib/db";

/**
 * GET /api/v1/categories
 * Returns all discovery categories ordered by sortOrder.
 */
export async function GET() {
  const categories = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      icon: true,
      sortOrder: true,
      _count: { select: { wallpapers: { where: { status: "approved", isPublic: true } } } },
    },
  });

  return NextResponse.json({
    data: categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      icon: c.icon,
      sortOrder: c.sortOrder,
      wallpaperCount: c._count.wallpapers,
    })),
  });
}
