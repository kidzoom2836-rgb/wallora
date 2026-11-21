/**
 * WALLORA Phase 9 — Marketplace seed.
 *
 * Creates real Product rows from the curator's approved wallpapers so the
 * storefront has genuine inventory from day one. Each product is backed by an
 * existing Wallpaper with real asset metadata — no fake data.
 *
 * Idempotent: safe to run multiple times. Skips wallpapers that already have a
 * matching Product (matched on title).
 *
 * Run with: bun run prisma/seed-marketplace.ts
 */
import { db } from "../src/lib/db";

const CURATOR_EMAIL = "curated@wallora.io";

/**
 * Per-wallpaper product overrides. Prices are in cents (Int):
 *   0    → "Free"
 *   499  → "$4.99"
 *   999  → "$9.99"
 *
 * We pick 5 wallpapers from the curator's approved showcase set with varied
 * prices (a free pack, a mid-tier premium pack, a luxury pack, etc.) to show
 * the marketplace supports both free and paid listings honestly.
 */
const PRODUCT_PLAN: { title: string; price: number; description: string }[] = [
  {
    title: "Futuristic Luxury Bedroom",
    price: 999,
    description:
      "A cinematic 4K concept pack — matte-black luxury bedroom with warm golden accent lighting and a panoramic neon skyline at dusk. Includes the full-resolution showcase visual plus a desktop-cropped variant.",
  },
  {
    title: "First Light",
    price: 0,
    description:
      "Misty ancient mountain forest at dawn with golden sunbeams. A free showcase pack released under the WALLORA Showcase license to celebrate the marketplace launch.",
  },
  {
    title: "Neon Reverie",
    price: 499,
    description:
      "Neon cyberpunk alley in rain at night — reflective puddles, holographic signs and moody purple-gold lighting. Premium vertical wallpaper pack, ideal for phone lock screens.",
  },
  {
    title: "Liquid Gold",
    price: 1499,
    description:
      "Abstract liquid gold flowing through dark charcoal texture. A premium art pack with the full-resolution showcase visual plus a square-cropped accent variant for product hero backgrounds.",
  },
  {
    title: "Midnight Aesthetics",
    price: 799,
    description:
      "A curated moodboard pack — deep blacks and navy with subtle gold accents across moody textures and shadows. Designed as a cohesive collection for desktop and ultrawide displays.",
  },
];

async function seed() {
  console.log("🌱 Seeding WALLORA marketplace products…\n");

  // 1. Locate the curator user.
  const curator = await db.user.findUnique({
    where: { email: CURATOR_EMAIL },
    include: { profile: true },
  });

  if (!curator) {
    throw new Error(
      `Curator user "${CURATOR_EMAIL}" not found. Run prisma/seed.ts first to bootstrap the curator and showcase wallpapers.`,
    );
  }

  console.log(`  ✓ Curator: @${curator.profile?.username ?? "wallora"} (${curator.id})`);

  // 2. Find the curator's approved wallpapers with their grid asset.
  const wallpapers = await db.wallpaper.findMany({
    where: {
      userId: curator.id,
      status: "approved",
      isPublic: true,
    },
    include: {
      assets: {
        where: { variant: { in: ["grid", "original", "detail"] } },
        select: { variant: true, objectKey: true, width: true, height: true },
        orderBy: { variant: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`  ✓ Curator has ${wallpapers.length} approved wallpapers available\n`);

  // 3. Match the plan to actual wallpapers by title.
  const matched = PRODUCT_PLAN.map((plan) => {
    const wallpaper = wallpapers.find((w) => w.title === plan.title);
    if (!wallpaper) {
      console.warn(`  ! Wallpaper "${plan.title}" not found — skipping`);
      return null;
    }
    const gridAsset =
      wallpaper.assets.find((a) => a.variant === "grid") ??
      wallpaper.assets.find((a) => a.variant === "original") ??
      wallpaper.assets[0];
    if (!gridAsset) {
      console.warn(`  ! Wallpaper "${plan.title}" has no usable asset — skipping`);
      return null;
    }
    return { plan, wallpaper, gridAsset };
  }).filter((m): m is NonNullable<typeof m> => m !== null);

  // 4. Idempotent create — skip if a Product already exists for this title
  //    by this creator.
  let created = 0;
  let skipped = 0;

  for (const { plan, wallpaper, gridAsset } of matched) {
    const existing = await db.product.findFirst({
      where: { creatorId: curator.id, title: plan.title },
      select: { id: true },
    });
    if (existing) {
      console.log(`  ✓ Product "${plan.title}" already exists — skipping`);
      skipped++;
      continue;
    }

    const product = await db.product.create({
      data: {
        creatorId: curator.id,
        title: plan.title,
        description: plan.description,
        price: plan.price,
        license: "WALLORA Showcase",
        coverUrl: gridAsset.objectKey,
        isPublished: true,
      },
      select: { id: true, title: true, price: true },
    });

    created++;
    const priceLabel =
      plan.price === 0 ? "Free" : `$${(plan.price / 100).toFixed(2)}`;
    console.log(
      `  + Created product "${product.title}" (${priceLabel}) — cover: ${gridAsset.objectKey}`,
    );
  }

  // 5. Summary.
  const totalProducts = await db.product.count();
  console.log(
    `\n✅ Marketplace seed complete: ${created} created, ${skipped} skipped, ${totalProducts} total products in store.`,
  );
  await db.$disconnect();
}

seed().catch((e) => {
  console.error("Marketplace seed failed:", e);
  process.exit(1);
});
