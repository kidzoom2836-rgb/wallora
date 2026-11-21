import {
  Film,
  Ruler,
  Gem,
  Zap,
  Leaf,
  Rocket,
  Shapes,
  Building2,
  Camera,
  Brush,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/**
 * WALLORA AI Studio style presets — per spec 5.8.
 *
 * Each preset appends a carefully crafted modifier to the user's prompt,
 * guiding the image model toward a specific aesthetic. The user's original
 * prompt is always preserved — presets only add direction.
 */

export type StylePreset = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  modifier: string;
};

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "none",
    name: "No preset",
    description: "Use your prompt as-is, no style modifier.",
    icon: Sparkles,
    modifier: "",
  },
  {
    id: "cinematic",
    name: "Cinematic",
    description: "Dramatic lighting, film-still composition, atmospheric depth.",
    icon: Film,
    modifier: "cinematic lighting, dramatic composition, film still, depth of field, high quality, detailed, 35mm",
  },
  {
    id: "minimalist",
    name: "Minimalist",
    description: "Clean, restrained, generous negative space.",
    icon: Ruler,
    modifier: "minimalist, clean composition, negative space, simple, elegant, refined, uncluttered",
  },
  {
    id: "luxury",
    name: "Luxury",
    description: "Premium materials, gold accents, rich textures.",
    icon: Gem,
    modifier: "luxury, premium, gold accents, rich textures, elegant, high-end, sophisticated lighting",
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    description: "Neon lights, futuristic, dark atmosphere.",
    icon: Zap,
    modifier: "cyberpunk, neon lights, futuristic, dark atmosphere, glowing, rain-soaked, holographic",
  },
  {
    id: "nature",
    name: "Nature",
    description: "Organic, lush, natural lighting.",
    icon: Leaf,
    modifier: "nature, organic, lush, natural lighting, serene, detailed foliage, golden hour",
  },
  {
    id: "futuristic",
    name: "Futuristic",
    description: "Sleek, sci-fi, advanced technology.",
    icon: Rocket,
    modifier: "futuristic, sleek, sci-fi, advanced technology, clean lines, ambient glow, high tech",
  },
  {
    id: "abstract",
    name: "Abstract",
    description: "Non-representational, textural, conceptual.",
    icon: Shapes,
    modifier: "abstract art, non-representational, textural, conceptual, flowing forms, bold colors",
  },
  {
    id: "architecture",
    name: "Architecture",
    description: "Structural, spatial, designed spaces.",
    icon: Building2,
    modifier: "architectural, structural, spatial design, clean geometry, professional photography, detailed",
  },
  {
    id: "photography",
    name: "Photography",
    description: "Realistic, captured-moment aesthetic.",
    icon: Camera,
    modifier: "professional photography, realistic, captured moment, natural lighting, high resolution, sharp focus",
  },
  {
    id: "illustration",
    name: "Digital illustration",
    description: "Hand-crafted, painted, illustrated.",
    icon: Brush,
    modifier: "digital illustration, hand-crafted, painted, stylized, vibrant, detailed artwork",
  },
  {
    id: "anime",
    name: "Anime-inspired",
    description: "Original anime-inspired illustration.",
    icon: Sparkles,
    modifier: "anime-inspired original illustration, expressive, detailed, painterly, vibrant colors, cel shading",
  },
];

export function getPreset(id: string): StylePreset {
  return STYLE_PRESETS.find((p) => p.id === id) ?? STYLE_PRESETS[0];
}

// ---------------------------------------------------------------------------
// Aspect ratio → SDK size mapping
// ---------------------------------------------------------------------------

export type AspectRatio = "square" | "portrait" | "landscape";

export const ASPECT_RATIOS: { id: AspectRatio; label: string; size: string; ratio: string }[] = [
  { id: "square", label: "Square", size: "1024x1024", ratio: "1:1" },
  { id: "portrait", label: "Portrait", size: "768x1344", ratio: "9:16" },
  { id: "landscape", label: "Landscape", size: "1344x768", ratio: "16:9" },
];

export function getSizeForAspect(aspect: AspectRatio): string {
  return ASPECT_RATIOS.find((a) => a.id === aspect)?.size ?? "1024x1024";
}
