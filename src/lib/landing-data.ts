import {
  Sparkles,
  MessageSquare,
  Image as ImageIcon,
  Wand2,
  Palette,
  Camera,
  Building2,
  Sofa,
  Shirt,
  BookOpen,
  Music,
  Leaf,
  Cpu,
  Car,
  Gamepad2,
  Ruler,
  Gem,
  Shapes,
  Aperture,
  Shirt as FashionIcon,
  Armchair,
  Brush,
  type LucideIcon,
} from "lucide-react";

export type Category = {
  id: string;
  label: string;
  icon: LucideIcon;
};

/** Categories per WALLORA spec 5.3 onboarding interests. */
export const CATEGORIES: Category[] = [
  { id: "nature", label: "Nature", icon: Leaf },
  { id: "technology", label: "Technology", icon: Cpu },
  { id: "cars", label: "Cars", icon: Car },
  { id: "anime", label: "Anime-inspired", icon: Sparkles },
  { id: "gaming", label: "Gaming", icon: Gamepad2 },
  { id: "architecture", label: "Architecture", icon: Building2 },
  { id: "minimalism", label: "Minimalism", icon: Ruler },
  { id: "luxury", label: "Luxury", icon: Gem },
  { id: "abstract", label: "Abstract art", icon: Shapes },
  { id: "photography", label: "Photography", icon: Aperture },
  { id: "fashion", label: "Fashion", icon: FashionIcon },
  { id: "interior", label: "Interior design", icon: Armchair },
  { id: "illustration", label: "Digital illustration", icon: Brush },
];

export type Studio = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  phase: string;
};

/** Creative studios per WALLORA spec 5.8 / 5.9. */
export const STUDIOS: Studio[] = [
  {
    id: "ai-chat",
    title: "WALLORA AI Chat",
    description:
      "A premium conversational interface with nine configurable modes — from Creative Assistant to Interior Designer.",
    icon: MessageSquare,
    phase: "Phase 5",
  },
  {
    id: "studio",
    title: "AI Studio",
    description:
      "Text-to-image, prompt enhancement, style presets, aspect ratios, variations and generation history.",
    icon: Wand2,
    phase: "Phase 6",
  },
  {
    id: "design",
    title: "Design Studio",
    description:
      "Posters, flyers, invitations, social artwork, banners and cover art.",
    icon: Palette,
    phase: "Phase 7",
  },
  {
    id: "photo",
    title: "Photo Studio",
    description:
      "Enhancement, background removal, restoration, color correction and cropping.",
    icon: Camera,
    phase: "Phase 7",
  },
  {
    id: "brand",
    title: "Brand Studio",
    description:
      "Brand concepts, logo studies, color systems, typography and moodboards.",
    icon: Gem,
    phase: "Phase 7",
  },
  {
    id: "interior",
    title: "Interior Studio",
    description:
      "Bedroom, living room, gaming setup and office concepts with curated palettes.",
    icon: Sofa,
    phase: "Phase 7",
  },
  {
    id: "fashion",
    title: "Fashion Studio",
    description:
      "Outfit inspiration, moodboards, style concepts and original fashion illustration.",
    icon: Shirt,
    phase: "Phase 7",
  },
  {
    id: "story",
    title: "Story Studio",
    description:
      "Original characters, storyboards, scene concepts and visual storytelling.",
    icon: BookOpen,
    phase: "Phase 7",
  },
  {
    id: "music",
    title: "Music Visual Studio",
    description:
      "Album covers, mixtape covers, posters and artist promotional graphics.",
    icon: Music,
    phase: "Phase 7",
  },
];

export type ShowcaseItem = {
  id: string;
  src: string;
  title: string;
  category: string;
  span: "tall" | "short" | "wide" | "square";
};

/** Featured showcase gallery — AI-generated concept samples (honestly labeled). */
export const SHOWCASE: ShowcaseItem[] = [
  {
    id: "cyberpunk",
    src: "/showcase/feat-cyberpunk.jpg",
    title: "Neon Reverie",
    category: "Cyberpunk",
    span: "tall",
  },
  {
    id: "architecture",
    src: "/showcase/feat-architecture.jpg",
    title: "Golden Hour Study",
    category: "Architecture",
    span: "square",
  },
  {
    id: "anime",
    src: "/showcase/feat-anime.jpg",
    title: "Solitary at Dusk",
    category: "Anime-inspired",
    span: "tall",
  },
  {
    id: "nature",
    src: "/showcase/feat-nature.jpg",
    title: "First Light",
    category: "Nature",
    span: "square",
  },
  {
    id: "abstract",
    src: "/showcase/feat-abstract.jpg",
    title: "Liquid Gold",
    category: "Abstract",
    span: "short",
  },
  {
    id: "luxury",
    src: "/showcase/feat-luxury.jpg",
    title: "Marbre Noir",
    category: "Luxury",
    span: "square",
  },
];

export type Collection = {
  id: string;
  src: string;
  title: string;
  description: string;
  count: number;
};

export const COLLECTIONS: Collection[] = [
  {
    id: "midnight",
    src: "/showcase/collection-midnight.jpg",
    title: "Midnight Aesthetics",
    description: "Deep blacks, navy shadows and quiet gold accents.",
    count: 18,
  },
  {
    id: "cyberdawn",
    src: "/showcase/collection-cyberdawn.jpg",
    title: "Cyber Dawn",
    description: "Neon orange and teal across futuristic skylines.",
    count: 24,
  },
  {
    id: "natural",
    src: "/showcase/collection-natural.jpg",
    title: "Natural Worlds",
    description: "Lush forests, waterfalls and golden sunlight.",
    count: 21,
  },
];

export type Plan = {
  id: string;
  name: string;
  tagline: string;
  priceLabel: string;
  priceNote: string;
  features: string[];
  cta: string;
  highlight?: boolean;
};

/** Plans per WALLORA spec Part 13. Prices marked "to be announced" — never hardcoded. */
export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "For exploring WALLORA",
    priceLabel: "Free",
    priceNote: "Forever",
    features: [
      "Browse the discovery feed",
      "Save favorites & build collections",
      "Limited daily AI conversations",
      "Community access",
      "PWA install on any device",
    ],
    cta: "Join the waitlist",
  },
  {
    id: "plus",
    name: "WALLORA Plus",
    tagline: "For active creators",
    priceLabel: "To be announced",
    priceNote: "Monthly · cancel anytime",
    features: [
      "Everything in Free",
      "Larger monthly AI generation allowance",
      "All creative studios",
      "Higher resolution exports",
      "Priority generation queue",
      "Private projects",
    ],
    cta: "Join the waitlist",
    highlight: true,
  },
  {
    id: "creator-pro",
    name: "WALLORA Creator Pro",
    tagline: "For selling your work",
    priceLabel: "To be announced",
    priceNote: "Monthly · cancel anytime",
    features: [
      "Everything in Plus",
      "Creator storefront",
      "Sell wallpaper packs & artwork",
      "Creator earnings ledger",
      "Higher configurable limits",
      "Verified creator status",
    ],
    cta: "Join the waitlist",
  },
];

export type Faq = {
  q: string;
  a: string;
};

export const FAQS: Faq[] = [
  {
    q: "What is WALLORA?",
    a: "WALLORA is an AI-powered creative ecosystem. You can discover inspiring visuals, talk to AI, generate original artwork, edit images, build creative projects, publish your work and monetize it — all in one place.",
  },
  {
    q: "Is WALLORA free to use?",
    a: "WALLORA has a free tier that lets you browse, save favorites, build collections and try limited daily AI conversations. Plus and Creator Pro plans with larger allowances and monetization features will be announced soon.",
  },
  {
    q: "When does AI Studio launch?",
    a: "AI Chat and AI Studio are live. Sign in to chat with the WALLORA assistant, enhance prompts and generate wallpapers — daily credit limits depend on your verification tier and role.",
  },
  {
    q: "Can I sell my creations on WALLORA?",
    a: "Yes. The marketplace is live with real listings, purchases and entitlements. Creators can publish their own products, and purchases are recorded in a real ledger — never fabricated. Card payments are not connected yet.",
  },
  {
    q: "What AI models does WALLORA use?",
    a: "WALLORA uses a capability-based provider abstraction. The primary provider is configured server-side and only exposes controls the underlying model actually supports. We never advertise capabilities a model does not have.",
  },
  {
    q: "Is my data safe?",
    a: "Sessions are server-side, roles are enforced on the server, API inputs are validated, and private media is never exposed through predictable public URLs. Full security hardening is detailed in the security phase of our roadmap.",
  },
  {
    q: "Can I use WALLORA on mobile?",
    a: "The web app is installable as a Progressive Web App on any device, and the native Android client is built with Expo. Both share the same backend contracts and your account.",
  },
  {
    q: "How do I join early access?",
    a: "Join the waitlist using any of the Start creating buttons on this page. You will be the first to know when early access opens, and founding members get priority onboarding.",
  },
];

export const EXAMPLE_PROMPTS: string[] = [
  "A futuristic luxury bedroom with black walls, golden lighting and a gaming setup overlooking Nairobi",
  "Give me five wallpapers that match a dark minimalist phone setup",
  "Design a cyberpunk album cover with neon orange and teal",
  "Create a brand moodboard for a premium coffee startup",
];
