"use client";

import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  Heart,
  Bookmark,
  Download,
  Share2,
  Loader2,
  CheckCircle2,
  Ruler,
  FileType,
  Calendar,
  Eye,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { VerifiedTick } from "@/components/brand/verified-badge";
import { CommentsSection } from "./comments-section";
import { FollowButton } from "./follow-button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useDiscovery } from "@/stores/discovery";
import { useAuthDialog } from "@/stores/auth-dialog";
import { cn } from "@/lib/utils";

type DetailAsset = {
  id: string;
  variant: string;
  objectKey: string;
  width: number;
  height: number;
  fileSize: number;
  format: string;
  mimeType: string;
};

type VariationPreview = {
  objectKey: string;
  width: number;
  height: number;
  variant?: string;
};

type Variation = {
  index: number;
  label: string;
  prefix?: string;
  previewAsset: VariationPreview | null;
  originalAsset?: DetailAsset | null;
  gridAsset?: DetailAsset | null;
  detailAsset?: DetailAsset | null;
  assets?: DetailAsset[];
};

type DetailResponse = {
  data: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    orientation: string;
    dominantColor: string | null;
    license: string;
    sourceType: string;
    likeCount: number;
    favoriteCount: number;
    downloadCount: number;
    viewCount: number;
    createdAt: string;
    category: { slug: string; name: string } | null;
    creator: {
      id: string;
      username: string | null;
      displayName: string | null;
      bio: string | null;
      verified: boolean;
      avatarUrl: string | null;
      tier: "free" | "verified" | "premium" | "supreme";
    };
    assets: DetailAsset[];
    variationCount?: number;
    variations?: Variation[];
    tags: { slug: string; name: string }[];
    liked: boolean;
    favorited: boolean;
    related: {
      id: string;
      slug: string;
      title: string;
      orientation: string;
      dominantColor: string | null;
      likeCount: number;
      asset: { objectKey: string; width: number; height: number } | null;
      variationCount?: number;
      variations?: { index: number; label: string; preview: VariationPreview | null }[];
    }[];
  };
};

export function WallpaperDetailDialog() {
  const { selectedSlug, setSelectedSlug } = useDiscovery();
  const { data: session } = useSession();
  const authenticated = !!session?.user;
  const openSignIn = useAuthDialog((s) => s.openSignIn);

  const { data, isLoading, isError } = useQuery<DetailResponse>({
    queryKey: ["wallpaper-detail", selectedSlug],
    queryFn: async () => {
      const res = await fetch(`/api/v1/wallpapers/${selectedSlug}`);
      if (!res.ok) throw new Error("Failed to load wallpaper");
      return res.json();
    },
    enabled: !!selectedSlug,
  });

  const wallpaper = data?.data;
  const originalAsset = wallpaper?.assets.find((a) => a.variant === "original") ?? wallpaper?.assets[0];
  const variations = wallpaper?.variations ?? [];
  const [activeVariation, setActiveVariation] = React.useState(0);

  React.useEffect(() => {
    setActiveVariation(0);
  }, [wallpaper?.id]);

  const activeVariationData = variations[activeVariation] ?? null;
  const heroAsset = activeVariationData?.previewAsset ?? originalAsset;
  const metaAsset = activeVariationData?.originalAsset ?? originalAsset;

  const [liked, setLiked] = React.useState(false);
  const [favorited, setFavorited] = React.useState(false);
  const [likeCount, setLikeCount] = React.useState(0);
  const [favoriteCount, setFavoriteCount] = React.useState(0);

  React.useEffect(() => {
    if (wallpaper) {
      setLiked(wallpaper.liked);
      setFavorited(wallpaper.favorited);
      setLikeCount(wallpaper.likeCount);
      setFavoriteCount(wallpaper.favoriteCount);
    }
  }, [wallpaper]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      const method = liked ? "DELETE" : "POST";
      const res = await fetch(`/api/v1/wallpapers/${wallpaper!.slug}/like`, { method });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onMutate: () => {
      setLiked((p) => !p);
      setLikeCount((p) => (liked ? Math.max(0, p - 1) : p + 1));
    },
    onError: () => {
      if (wallpaper) {
        setLiked(wallpaper.liked);
        setLikeCount(wallpaper.likeCount);
      }
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      const method = favorited ? "DELETE" : "POST";
      const res = await fetch(`/api/v1/wallpapers/${wallpaper!.slug}/favorite`, { method });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onMutate: () => {
      setFavorited((p) => !p);
      setFavoriteCount((p) => (favorited ? Math.max(0, p - 1) : p + 1));
    },
    onError: () => {
      if (wallpaper) {
        setFavorited(wallpaper.favorited);
        setFavoriteCount(wallpaper.favoriteCount);
      }
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (variant?: string) => {
      const query = variant ? `?variant=${encodeURIComponent(variant)}` : "";
      const res = await fetch(`/api/v1/wallpapers/${wallpaper!.slug}/download${query}`, { method: "POST" });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: (data: { data: { url: string; filename: string } }) => {
      // Open the download URL in a new tab (triggers download for same-origin images)
      const a = document.createElement("a");
      a.href = data.data.url;
      a.download = data.data.filename;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Download started", {
        description: `Saving ${data.data.filename}`,
      });
    },
    onError: () => {
      toast.error("Download failed", { description: "Please try again." });
    },
  });

  const handleLike = () => {
    if (!authenticated) { openSignIn(); return; }
    likeMutation.mutate();
  };
  const handleFavorite = () => {
    if (!authenticated) { openSignIn(); return; }
    favoriteMutation.mutate();
  };
  const handleDownload = () => {
    if (!wallpaper) return;
    downloadMutation.mutate(metaAsset?.variant);
  };
  const handleShare = async () => {
    if (!wallpaper) return;
    const url = `${window.location.origin}/wallpaper/${wallpaper.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: wallpaper.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied", { description: wallpaper.title });
      }
    } catch {
      // user cancelled share
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) setSelectedSlug(null);
  };

  return (
    <Dialog open={!!selectedSlug} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl border-border bg-background p-0 sm:max-w-4xl">
        <DialogTitle className="sr-only">
          {wallpaper?.title ?? "Wallpaper detail"}
        </DialogTitle>
        {isLoading ? (
          <div className="flex h-[400px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-secondary-text" />
          </div>
        ) : isError || !wallpaper ? (
          <div className="flex h-[300px] flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="font-medium text-foreground">Could not load this wallpaper</p>
            <Button variant="outline" className="border-border" onClick={() => setSelectedSlug(null)}>
              Close
            </Button>
          </div>
        ) : (
          <div className="grid max-h-[90vh] overflow-y-auto lg:grid-cols-[1.4fr_1fr]">
            {/* Image */}
            <div className="relative bg-black/40">
              {heroAsset && (
                <img
                  src={heroAsset.objectKey}
                  alt={activeVariationData ? `${wallpaper.title} — ${activeVariationData.label}` : wallpaper.title}
                  className="h-full max-h-[60vh] w-full object-contain lg:max-h-[90vh]"
                />
              )}
              <div className="absolute left-3 top-3">
                <span className="rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium text-secondary-text backdrop-blur">
                  {wallpaper.sourceType === "showcase" ? "WALLORA Showcase" : wallpaper.sourceType}
                </span>
              </div>

              {/* Variation gallery — every approved source image in one post. */}
              {variations.length > 1 && (
                <div className="absolute inset-x-3 bottom-3 flex gap-2 overflow-x-auto pb-1">
                  {variations.map((variation, index) => (
                    <button
                      key={variation.index}
                      type="button"
                      onClick={() => setActiveVariation(index)}
                      aria-label={`Show ${variation.label}`}
                      aria-pressed={index === activeVariation}
                      className={cn(
                        "flex shrink-0 flex-col gap-1 rounded-lg border p-1 text-left backdrop-blur transition-colors",
                        index === activeVariation
                          ? "border-primary bg-background/90"
                          : "border-border bg-background/70 hover:border-primary/50",
                      )}
                    >
                      {variation.previewAsset && (
                        <img
                          src={variation.previewAsset.objectKey}
                          alt=""
                          className="h-12 w-16 rounded object-cover"
                          loading="lazy"
                        />
                      )}
                      <span className="max-w-16 truncate px-0.5 text-[10px] font-medium text-foreground">
                        {variation.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="flex flex-col gap-5 p-6">
              {/* Title + creator */}
              <div>
                <h2 className="font-display text-xl font-semibold text-foreground">
                  {wallpaper.title}
                </h2>
                <div className="mt-2 flex items-center gap-2">
                  {wallpaper.creator.username && (
                    <div className="ml-auto">
                      <FollowButton
                        username={wallpaper.creator.username}
                        initialFollowing={false}
                        isSelf={session?.user?.id === wallpaper.creator.id}
                      />
                    </div>
                  )}
                  <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {wallpaper.creator.avatarUrl ? (
                      <img
                        src={wallpaper.creator.avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (wallpaper.creator.displayName ?? "W")[0]?.toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/profile/${wallpaper.creator.username ?? ""}`}
                      onClick={() => setSelectedSlug(null)}
                      className="flex items-center gap-1 truncate text-sm font-medium text-foreground hover:text-primary"
                    >
                      <span className="truncate">
                        {wallpaper.creator.displayName ?? "WALLORA"}
                      </span>
                      <VerifiedTick tier={wallpaper.creator.tier} className="size-3.5" />
                    </Link>
                    <p className="truncate text-xs text-secondary-text">
                      @{wallpaper.creator.username ?? "wallora"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {wallpaper.description && (
                <p className="text-sm leading-relaxed text-secondary-text">
                  {wallpaper.description}
                </p>
              )}

              {/* Actions */}
              <div className="grid grid-cols-4 gap-2">
                <ActionButton
                  icon={Heart}
                  label="Like"
                  count={likeCount}
                  active={liked}
                  activeColor="text-destructive border-destructive bg-destructive/20"
                  onClick={handleLike}
                  loading={likeMutation.isPending}
                />
                <ActionButton
                  icon={Bookmark}
                  label="Save"
                  count={favoriteCount}
                  active={favorited}
                  activeColor="text-primary border-primary bg-primary/20"
                  onClick={handleFavorite}
                  loading={favoriteMutation.isPending}
                />
                <ActionButton
                  icon={Download}
                  label="Download"
                  count={wallpaper.downloadCount}
                  active={false}
                  onClick={handleDownload}
                  loading={downloadMutation.isPending}
                />
                <ActionButton
                  icon={Share2}
                  label="Share"
                  count={undefined}
                  active={false}
                  onClick={handleShare}
                  loading={false}
                />
              </div>

              {!authenticated && (
                <p className="rounded-lg border border-border bg-surface p-3 text-xs text-secondary-text">
                  <CheckCircle2 className="mr-1 inline h-3 w-3 text-primary" />
                  Sign in to like, save and download.
                </p>
              )}

              <Separator className="bg-border" />

              {/* Metadata */}
              <dl className="grid grid-cols-2 gap-3 text-xs">
                {metaAsset && (
                  <>
                    <MetaRow icon={Ruler} label="Dimensions" value={`${metaAsset.width} × ${metaAsset.height}`} />
                    <MetaRow icon={FileType} label="Format" value={metaAsset.format.toUpperCase()} />
                    <MetaRow icon={Eye} label="Views" value={String(wallpaper.viewCount)} />
                    <MetaRow icon={Calendar} label="Added" value={new Date(wallpaper.createdAt).toLocaleDateString()} />
                  </>
                )}
                {(wallpaper.variationCount ?? variations.length) > 1 && (
                  <MetaRow
                    icon={Ruler}
                    label="Variations"
                    value={String(wallpaper.variationCount ?? variations.length)}
                  />
                )}
                <MetaRow icon={Shield} label="License" value={wallpaper.license} />
                <MetaRow icon={Ruler} label="Orientation" value={wallpaper.orientation} />
              </dl>

              {/* Tags */}
              {wallpaper.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {wallpaper.tags.map((t) => (
                    <Badge
                      key={t.slug}
                      variant="outline"
                      className="border-border bg-surface text-[11px] text-secondary-text"
                    >
                      {t.name}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Related */}
              {wallpaper.related.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-secondary-text">
                    More in {wallpaper.category?.name ?? "this category"}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {wallpaper.related.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedSlug(r.slug)}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface"
                      >
                        {r.asset && (
                          <img
                            src={r.asset.objectKey}
                            alt={r.title}
                            className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-110"
                            loading="lazy"
                          />
                        )}
                        {(r.variationCount ?? r.variations?.length ?? 0) > 1 && (
                          <div className="absolute inset-x-1 top-1 flex gap-0.5">
                            {r.variations?.map((variation) =>
                              variation.preview ? (
                                <img
                                  key={variation.index}
                                  src={variation.preview.objectKey}
                                  alt=""
                                  className="h-6 w-8 rounded-sm border border-border/80 object-cover"
                                  loading="lazy"
                                />
                              ) : null,
                            )}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                        <p className="absolute inset-x-1 bottom-1 truncate text-[10px] font-medium text-foreground">
                          {r.title}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Separator className="bg-border" />

              <CommentsSection slug={wallpaper.slug} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActionButton({
  icon: Icon,
  label,
  count,
  active,
  activeColor,
  onClick,
  loading,
}: {
  icon: typeof Heart;
  label: string;
  count?: number;
  active: boolean;
  activeColor?: string;
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border border-border bg-surface px-2 py-2.5 transition-colors hover:border-primary/30",
        active && activeColor,
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className={cn("h-4 w-4", active && "fill-current")} />
      )}
      <span className="text-[10px] font-medium">{label}</span>
      {count !== undefined && <span className="text-[10px] text-secondary-text">{count}</span>}
    </button>
  );
}

function MetaRow({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="flex items-center gap-1 text-secondary-text">
        <Icon className="h-3 w-3" />
        {label}
      </dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
