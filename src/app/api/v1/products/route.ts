import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireVerification } from "@/lib/auth-helpers";
import { getTiersForUsers } from "@/lib/verification/store";

const LICENSES = ["Personal", "Commercial", "Extended"] as const;
type ProductLicense = (typeof LICENSES)[number];

function isSafeCoverUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  if (trimmed.startsWith("//")) return false;
  return trimmed.startsWith("/") || /^https?:\/\//i.test(trimmed);
}

/** Shared body rules for POST (required fields) and PATCH (partial). */
const productFields = {
  title: z.string().trim().min(1, { message: "Title is required" }).max(120),
  description: z.string().trim().max(2000, { message: "Description must be at most 2000 characters" }),
  price: z.number().int().min(0).max(10_000_000),
  license: z.enum(LICENSES),
  coverUrl: z.string().trim().max(2048).nullable(),
  isPublished: z.boolean(),
};

const CreateProductSchema = z.object(productFields).refine(
  (body) => !body.coverUrl || isSafeCoverUrl(body.coverUrl),
  { path: ["coverUrl"], message: "Cover URL must be an http(s) or same-origin path" },
);

/**
 * GET /api/v1/products
 *
 * Lists published marketplace products.
 *
 * Query params:
 *   q / search — match title + description
 *   license    — Personal | Commercial | Extended
 *   sort       — newest | popular | price-asc | price-desc
 *   page       — 1-based page number (default 1)
 *   limit      — items per page (default 12, max 24)
 *   creator    — filter by creator username (e.g. "wallora")
 *
 * Response:
 *   { data: { items: Product[], pagination: {...} } }
 *
 * Each item includes the creator profile (username, displayName, avatarUrl,
 * verified, tier) and the live purchase count.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(24, Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10) || 12));
  const creator = searchParams.get("creator")?.trim() ?? "";
  const q = (searchParams.get("q") ?? searchParams.get("search") ?? "").trim().slice(0, 120);
  const licenseParam = searchParams.get("license")?.trim() ?? "";
  const sort = searchParams.get("sort")?.trim() ?? "newest";

  const where: Record<string, unknown> = {
    isPublished: true,
  };
  if (creator) where.creator = { profile: { username: creator } };
  if (q) where.OR = [{ title: { contains: q } }, { description: { contains: q } }];
  if ((LICENSES as readonly string[]).includes(licenseParam)) where.license = licenseParam;

  let orderBy: Record<string, unknown> = { createdAt: "desc" };
  if (sort === "price-asc") orderBy = { price: "asc" };
  else if (sort === "price-desc") orderBy = { price: "desc" };
  else if (sort === "popular") orderBy = { purchases: { _count: "desc" } };

  const [total, items] = await Promise.all([
    db.product.count({ where: where as never }),
    db.product.findMany({
      where: where as never,
      orderBy: orderBy as never,
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
              select: { username: true, displayName: true, verified: true, avatarUrl: true },
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

  const tiers = await getTiersForUsers(items.map((p) => p.creator.id));
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
      avatarUrl: p.creator.profile?.avatarUrl ?? null,
      tier: tiers[p.creator.id] ?? "free",
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

/**
 * POST /api/v1/products
 *
 * Create a marketplace listing owned by the signed-in creator. Baseline
 * verification is required, matching the other creator publishing endpoints.
 */
export async function POST(request: NextRequest) {
  const auth = await requireVerification();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }
  const parsed = CreateProductSchema.safeParse(body);
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
  const product = await db.product.create({
    data: {
      creatorId: auth.session.user.id,
      title: input.title,
      description: input.description || null,
      price: input.price,
      license: input.license,
      coverUrl: input.coverUrl || null,
      isPublished: input.isPublished ?? true,
    },
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
            select: { username: true, displayName: true, verified: true, avatarUrl: true },
          },
        },
      },
    },
  });

  const tiers = await getTiersForUsers([auth.session.user.id]);
  return NextResponse.json(
    {
      data: {
        ...product,
        creator: {
          id: product.creator.id,
          username: product.creator.profile?.username ?? null,
          displayName: product.creator.profile?.displayName ?? null,
          verified: product.creator.profile?.verified ?? false,
          avatarUrl: product.creator.profile?.avatarUrl ?? null,
          tier: tiers[auth.session.user.id] ?? "free",
        },
        purchaseCount: 0,
      },
      message: "Listing created.",
    },
    { status: 201 },
  );
}
