/**
 * WALLORA Phase 3 seed.
 *
 * Creates real database-backed discovery content from the AI-generated
 * showcase visuals. Every record is a genuine Wallpaper row with real asset
 * metadata — no fake production data, no placeholder arrays.
 *
 * Idempotent: safe to run multiple times (upserts skip existing rows).
 *
 * Run with: bun run prisma/seed.ts
 */
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";

// Documented admin login — usable on any fresh database after seeding.
// Email: admin@wallora.io
// Password: Wallora!Admin2025
const ADMIN_EMAIL = "admin@wallora.io";
const ADMIN_PASSWORD = "Wallora!Admin2025";

type ShowcaseImage = {
  file: string;
  title: string;
  description: string;
  categorySlug: string;
  orientation: "portrait" | "landscape" | "square";
  width: number;
  height: number;
  fileSize: number;
  dominantColor: string;
  tags: string[];
  license: string;
};

const SHOWCASE_IMAGES: ShowcaseImage[] = [
  {
    file: "hero.jpg",
    title: "Futuristic Luxury Bedroom",
    description:
      "A cinematic concept of a matte-black luxury bedroom with warm golden accent lighting, a minimalist gaming setup and a panoramic window overlooking a neon city skyline at dusk.",
    categorySlug: "interior",
    orientation: "landscape",
    width: 1344,
    height: 768,
    fileSize: 134465,
    dominantColor: "#D7B879",
    tags: ["luxury", "futuristic", "dark", "golden", "cinematic", "bedroom"],
    license: "WALLORA Showcase",
  },
  {
    file: "feat-nature.jpg",
    title: "First Light",
    description:
      "Misty ancient mountain forest at dawn with golden sunbeams piercing through towering trees.",
    categorySlug: "nature",
    orientation: "square",
    width: 1024,
    height: 1024,
    fileSize: 197217,
    dominantColor: "#7A8B5C",
    tags: ["nature", "forest", "fog", "golden", "cinematic", "serene"],
    license: "WALLORA Showcase",
  },
  {
    file: "feat-cyberpunk.jpg",
    title: "Neon Reverie",
    description:
      "A neon cyberpunk alley in rain at night with reflective puddles, holographic signs and moody purple-gold lighting.",
    categorySlug: "technology",
    orientation: "portrait",
    width: 768,
    height: 1344,
    fileSize: 198794,
    dominantColor: "#8B5CF6",
    tags: ["cyberpunk", "neon", "rain", "night", "cityscape", "cinematic"],
    license: "WALLORA Showcase",
  },
  {
    file: "feat-architecture.jpg",
    title: "Golden Hour Study",
    description:
      "Luxury minimalist interior with black marble and warm walnut wood, golden hour light streaming through floor-to-ceiling windows.",
    categorySlug: "architecture",
    orientation: "square",
    width: 1024,
    height: 1024,
    fileSize: 115208,
    dominantColor: "#C8A878",
    tags: ["architecture", "interior", "minimalist", "golden", "luxury", "marble"],
    license: "WALLORA Showcase",
  },
  {
    file: "feat-anime.jpg",
    title: "Solitary at Dusk",
    description:
      "Original anime-inspired character concept — a solitary figure with a flowing dark cloak standing on a rooftop at golden sunset.",
    categorySlug: "anime",
    orientation: "portrait",
    width: 768,
    height: 1344,
    fileSize: 111017,
    dominantColor: "#E8A04D",
    tags: ["anime", "character", "sunset", "rooftop", "illustration", "cinematic"],
    license: "WALLORA Showcase",
  },
  {
    file: "feat-abstract.jpg",
    title: "Liquid Gold",
    description:
      "Abstract liquid gold flowing through dark charcoal texture — elegant premium abstract art with flowing organic forms.",
    categorySlug: "abstract",
    orientation: "square",
    width: 1024,
    height: 1024,
    fileSize: 240708,
    dominantColor: "#D7B879",
    tags: ["abstract", "gold", "liquid", "dark", "premium", "texture"],
    license: "WALLORA Showcase",
  },
  {
    file: "feat-luxury.jpg",
    title: "Marbre Noir",
    description:
      "Luxury still life on a black marble surface — a gold watch and minimalist perfume bottle under dramatic single-source lighting.",
    categorySlug: "luxury",
    orientation: "square",
    width: 1024,
    height: 1024,
    fileSize: 108932,
    dominantColor: "#1C1F26",
    tags: ["luxury", "still-life", "gold", "marble", "dark", "premium"],
    license: "WALLORA Showcase",
  },
  {
    file: "collection-midnight.jpg",
    title: "Midnight Aesthetics",
    description:
      "A curated collection moodboard — deep blacks and navy with subtle gold accents across moody textures and shadows.",
    categorySlug: "minimalism",
    orientation: "landscape",
    width: 1344,
    height: 768,
    fileSize: 175705,
    dominantColor: "#1A1F2E",
    tags: ["minimalist", "dark", "midnight", "moodboard", "navy", "gold"],
    license: "WALLORA Showcase",
  },
  {
    file: "collection-cyberdawn.jpg",
    title: "Cyber Dawn",
    description:
      "A cyberpunk dawn cityscape moodboard with neon orange and teal across futuristic skyline silhouettes.",
    categorySlug: "technology",
    orientation: "landscape",
    width: 1344,
    height: 768,
    fileSize: 160762,
    dominantColor: "#FF6B35",
    tags: ["cyberpunk", "dawn", "neon", "cityscape", "orange", "teal"],
    license: "WALLORA Showcase",
  },
  {
    file: "collection-natural.jpg",
    title: "Natural Worlds",
    description:
      "A natural worlds moodboard — lush forests and cascading waterfalls with earthy greens and golden sunlight.",
    categorySlug: "nature",
    orientation: "landscape",
    width: 1344,
    height: 768,
    fileSize: 226774,
    dominantColor: "#4A6B3A",
    tags: ["nature", "forest", "waterfall", "green", "golden", "moodboard"],
    license: "WALLORA Showcase",
  },
];

const CATEGORIES: { slug: string; name: string; description: string; icon: string; sortOrder: number }[] = [
  { slug: "nature", name: "Nature", description: "Forests, mountains, oceans, skies and the natural world.", icon: "Leaf", sortOrder: 1 },
  { slug: "technology", name: "Technology", description: "Cyberpunk, sci-fi, neon cities and futuristic concepts.", icon: "Cpu", sortOrder: 2 },
  { slug: "cars", name: "Cars", description: "Automotive concepts, supercars and vehicle design.", icon: "Car", sortOrder: 3 },
  { slug: "anime", name: "Anime-inspired", description: "Original anime-inspired character art and illustration.", icon: "Sparkles", sortOrder: 4 },
  { slug: "gaming", name: "Gaming", description: "Gaming setups, game art and interactive worlds.", icon: "Gamepad2", sortOrder: 5 },
  { slug: "architecture", name: "Architecture", description: "Buildings, structures and spatial design.", icon: "Building2", sortOrder: 6 },
  { slug: "minimalism", name: "Minimalism", description: "Clean, restrained and intentionally simple visuals.", icon: "Ruler", sortOrder: 7 },
  { slug: "luxury", name: "Luxury", description: "Premium materials, gold accents and refined aesthetics.", icon: "Gem", sortOrder: 8 },
  { slug: "abstract", name: "Abstract art", description: "Non-representational, textural and conceptual art.", icon: "Shapes", sortOrder: 9 },
  { slug: "photography", name: "Photography", description: "Captured moments and photographic art.", icon: "Aperture", sortOrder: 10 },
  { slug: "fashion", name: "Fashion", description: "Outfits, style concepts and fashion illustration.", icon: "Shirt", sortOrder: 11 },
  { slug: "interior", name: "Interior design", description: "Rooms, spaces and interior concepts.", icon: "Armchair", sortOrder: 12 },
  { slug: "illustration", name: "Digital illustration", description: "Hand-crafted and digital illustration art.", icon: "Brush", sortOrder: 13 },
];

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function seed() {
  console.log("🌱 Seeding WALLORA discovery content…");

  // 1. System curator user
  const curatorEmail = "curated@wallora.io";
  let curator = await db.user.findUnique({ where: { email: curatorEmail } });
  if (!curator) {
    curator = await db.user.create({
      data: {
        email: curatorEmail,
        name: "WALLORA Curated",
        role: "admin",
        status: "active",
        passwordHash: null,
        profile: {
          create: {
            username: "wallora",
            displayName: "WALLORA Curated",
            bio: "Official WALLORA showcase collection — curated concept visuals.",
            verified: true,
            creatorStatus: "approved",
          },
        },
        settings: { create: {} },
      },
      include: { profile: true },
    });
    console.log(`  ✓ Created curator user @${curator.profile?.username}`);
  } else {
    console.log(`  ✓ Curator user exists @${curator.email}`);
  }

  // 1b. Documented admin login (super_admin) — usable from the sign-in page.
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const admin = await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash: adminHash, role: "super_admin", status: "active" },
    create: {
      email: ADMIN_EMAIL,
      name: "WALLORA Admin",
      role: "super_admin",
      status: "active",
      passwordHash: adminHash,
      profile: {
        create: {
          username: "wallora-admin",
          displayName: "WALLORA Admin",
          bio: "WALLORA platform administrator.",
          verified: true,
          creatorStatus: "approved",
        },
      },
      settings: { create: {} },
    },
    include: { profile: true },
  });
  console.log(`  ✓ Admin login ready: ${admin.email} / (see ADMIN_PASSWORD in seed.ts)`);

  // 2. Categories
  for (const cat of CATEGORIES) {
    await db.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description, icon: cat.icon, sortOrder: cat.sortOrder },
      create: cat,
    });
  }
  console.log(`  ✓ ${CATEGORIES.length} categories ensured`);

  // 3. Tags + wallpapers + assets
  const tagCache = new Map<string, string>();
  async function ensureTag(name: string): Promise<string> {
    const slug = slugify(name);
    if (tagCache.has(slug)) return tagCache.get(slug)!;
    const tag = await db.tag.upsert({
      where: { slug },
      update: {},
      create: { slug, name: name.toLowerCase() },
    });
    tagCache.set(slug, tag.id);
    return tag.id;
  }

  let wallpaperCount = 0;
  for (const img of SHOWCASE_IMAGES) {
    const slug = slugify(img.title);
    const category = await db.category.findUnique({ where: { slug: img.categorySlug } });
    if (!category) {
      console.warn(`  ! Category not found: ${img.categorySlug}, skipping ${img.title}`);
      continue;
    }

    const existing = await db.wallpaper.findUnique({ where: { slug } });
    if (existing) {
      console.log(`  ✓ Wallpaper "${img.title}" already exists — skipping`);
      continue;
    }

    const wallpaper = await db.wallpaper.create({
      data: {
        slug,
        title: img.title,
        description: img.description,
        userId: curator.id,
        categoryId: category.id,
        status: "approved",
        license: img.license,
        orientation: img.orientation,
        dominantColor: img.dominantColor,
        sourceType: "showcase",
        isPublic: true,
        assets: {
          create: [
            {
              variant: "original",
              objectKey: `/showcase/${img.file}`,
              width: img.width,
              height: img.height,
              fileSize: img.fileSize,
              format: "jpg",
              mimeType: "image/jpeg",
            },
            {
              variant: "grid",
              objectKey: `/showcase/${img.file}`,
              width: img.width,
              height: img.height,
              fileSize: img.fileSize,
              format: "jpg",
              mimeType: "image/jpeg",
            },
            {
              variant: "detail",
              objectKey: `/showcase/${img.file}`,
              width: img.width,
              height: img.height,
              fileSize: img.fileSize,
              format: "jpg",
              mimeType: "image/jpeg",
            },
          ],
        },
        tags: {
          create: await Promise.all(
            img.tags.map(async (t) => ({ tagId: await ensureTag(t) })),
          ),
        },
      },
    });

    wallpaperCount++;
    console.log(`  ✓ Created wallpaper "${wallpaper.title}" (${img.orientation} ${img.width}x${img.height})`);
  }

  // 4. Summary
  const counts = await Promise.all([
    db.category.count(),
    db.tag.count(),
    db.wallpaper.count(),
    db.wallpaperAsset.count(),
    db.wallpaperTag.count(),
  ]);
  console.log(
    `\n✅ Seed complete: ${counts[0]} categories, ${counts[1]} tags, ${counts[2]} wallpapers, ${counts[3]} assets, ${counts[4]} tag links`,
  );
  await db.$disconnect();
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
