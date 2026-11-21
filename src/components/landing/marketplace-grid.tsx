"use client";

import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  Store,
  BadgeCheck,
  ShoppingCart,
  Loader2,
  PackageOpen,
  AlertCircle,
  ShieldCheck,
  Tag,
  Users,
  Info,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useAuthDialog } from "@/stores/auth-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SectionHeading } from "./section-heading";

// ---------------------------------------------------------------------------
// Types — mirror the API response shapes.
// ---------------------------------------------------------------------------

type ProductSummary = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  license: string;
  coverUrl: string | null;
  createdAt: string;
  creator: {
    id: string;
    username: string | null;
    displayName: string | null;
    verified: boolean;
  };
  purchaseCount: number;
};

type ListResponse = {
  data: {
    items: ProductSummary[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
};

type ProductDetail = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  license: string;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    username: string | null;
    displayName: string | null;
    verified: boolean;
    bio: string | null;
    avatarUrl: string | null;
  };
  purchaseCount: number;
  owned: boolean;
  purchase?: {
    id: string;
    status: string;
    createdAt: string;
  };
};

type DetailResponse = { data: ProductDetail };

type PurchaseResponse = {
  data: {
    purchase: {
      id: string;
      userId: string;
      productId: string;
      price: number;
      status: string;
      createdAt: string;
    };
    alreadyOwned: boolean;
    demo: {
      note: string;
      paymentProvider: string | null;
    };
  };
};

// ---------------------------------------------------------------------------
// Price formatting — 0 = "Free", 499 = "$4.99", 999 = "$9.99".
// ---------------------------------------------------------------------------

function formatPrice(cents: number): string {
  if (!cents || cents <= 0) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * MarketplaceGrid — a responsive storefront grid backed by /api/v1/products.
 *
 * Phase 9: lists published products, opens a detail dialog with full info,
 * and supports a simplified demo purchase flow (no real payment gateway).
 */
export function MarketplaceGrid() {
  const { data: session } = useSession();
  const authenticated = !!session?.user;
  const openSignIn = useAuthDialog((s) => s.openSignIn);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Fetch the published products.
  const productsQuery = useQuery<ListResponse>({
    queryKey: ["marketplace-products", { limit: 12 }],
    queryFn: async () => {
      const res = await fetch("/api/v1/products?limit=12");
      if (!res.ok) throw new Error("Failed to load marketplace products");
      return res.json();
    },
  });

  const products = productsQuery.data?.data.items ?? [];

  return (
    <section
      id="marketplace-grid"
      className="relative border-y border-border bg-background py-20 sm:py-24"
      aria-labelledby="marketplace-grid-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Marketplace"
          title={<>Premium packs, real storefronts</>}
          subtitle="Curated wallpaper packs from verified creators. Browse the showcase inventory below — every pack carries a clear license and an honest purchase count."
        />

        <div className="mt-10">
          {productsQuery.isLoading ? (
            <MarketplaceSkeleton />
          ) : productsQuery.isError ? (
            <MarketplaceError
              onRetry={() => productsQuery.refetch()}
              message="We couldn't load the marketplace right now."
            />
          ) : products.length === 0 ? (
            <MarketplaceEmpty />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {products.map((p, idx) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  index={idx}
                  onSelect={() => setSelectedId(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail dialog — controlled by local state */}
      <MarketplaceDetailDialog
        productId={selectedId}
        onClose={() => setSelectedId(null)}
        authenticated={authenticated}
        onRequireAuth={() => openSignIn()}
        onPurchased={() => {
          // Refresh the product list so purchase counts update.
          productsQuery.refetch();
        }}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Product card
// ---------------------------------------------------------------------------

function ProductCard({
  product,
  index,
  onSelect,
}: {
  product: ProductSummary;
  index: number;
  onSelect: () => void;
}) {
  const priceLabel = formatPrice(product.price);
  const isFree = product.price === 0;
  const creatorName = product.creator.displayName ?? product.creator.username ?? "WALLORA";

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-surface",
        "transition-colors hover:border-primary/40",
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-label={`View ${product.title} — ${priceLabel}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* Cover image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-raised">
        {product.coverUrl ? (
          <img
            src={product.coverUrl}
            alt={`${product.title} cover`}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 animate-shimmer" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent opacity-80 transition-opacity group-hover:opacity-95" />

        {/* Price badge */}
        <div className="absolute right-2 top-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-semibold backdrop-blur",
              isFree
                ? "border-success/40 bg-success/20 text-success"
                : "border-primary/40 bg-primary/20 text-primary",
            )}
          >
            {priceLabel}
          </span>
        </div>

        {/* License badge */}
        <div className="absolute left-2 top-2">
          <span className="rounded-full border border-border bg-background/70 px-2 py-0.5 text-[10px] font-medium text-secondary-text backdrop-blur">
            {product.license}
          </span>
        </div>
      </div>

      {/* Caption */}
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-semibold text-foreground">
            {product.title}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-secondary-text">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
            {creatorName.charAt(0).toUpperCase()}
          </span>
          <span className="truncate">{creatorName}</span>
          {product.creator.verified && (
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Verified creator" />
          )}
        </div>
        <Separator className="bg-border" />
        <div className="flex items-center justify-between text-[11px] text-secondary-text">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {product.purchaseCount} {product.purchaseCount === 1 ? "purchase" : "purchases"}
          </span>
          <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <ShoppingCart className="h-3 w-3" />
            View pack
          </span>
        </div>
      </div>
    </motion.article>
  );
}

// ---------------------------------------------------------------------------
// Detail dialog
// ---------------------------------------------------------------------------

function MarketplaceDetailDialog({
  productId,
  onClose,
  authenticated,
  onRequireAuth,
  onPurchased,
}: {
  productId: string | null;
  onClose: () => void;
  authenticated: boolean;
  onRequireAuth: () => void;
  onPurchased: () => void;
}) {
  const { data, isLoading, isError, refetch } = useQuery<DetailResponse>({
    queryKey: ["marketplace-product", productId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/products/${productId}`);
      if (!res.ok) throw new Error("Failed to load product");
      return res.json();
    },
    enabled: !!productId,
  });

  const product = data?.data;

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/products/${productId}/purchase`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const message = body?.error?.message ?? "Purchase failed";
        throw new Error(message);
      }
      return body as PurchaseResponse;
    },
    onSuccess: (body) => {
      const { alreadyOwned, demo } = body.data;
      if (alreadyOwned) {
        toast.success("Already in your library", {
          description: "You already own this pack — no new purchase was created.",
        });
      } else {
        toast.success("Pack added to your library", {
          description: demo.note,
        });
      }
      // Refresh the detail query so the owned flag flips.
      refetch();
      onPurchased();
    },
    onError: (err: Error) => {
      toast.error("Purchase failed", { description: err.message });
    },
  });

  const handlePurchase = () => {
    if (!product) return;
    if (product.owned) {
      toast.info("Already owned", {
        description: "This pack is already in your library.",
      });
      return;
    }
    if (!authenticated) {
      onRequireAuth();
      return;
    }
    purchaseMutation.mutate();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  const priceLabel = product ? formatPrice(product.price) : "";
  const isFree = product?.price === 0;
  const creatorName = product?.creator.displayName ?? product?.creator.username ?? "WALLORA";

  return (
    <Dialog open={!!productId} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl border-border bg-background p-0 sm:max-w-4xl">
        <DialogTitle className="sr-only">
          {product?.title ?? "Product detail"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {product?.description ?? "View this marketplace pack and its license."}
        </DialogDescription>

        {isLoading ? (
          <div className="flex h-[420px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-secondary-text" />
          </div>
        ) : isError || !product ? (
          <div className="flex h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="font-medium text-foreground">Could not load this pack</p>
            <Button variant="outline" className="border-border" onClick={() => onClose()}>
              Close
            </Button>
          </div>
        ) : (
          <div className="grid max-h-[90vh] overflow-y-auto lg:grid-cols-[1.3fr_1fr]">
            {/* Cover */}
            <div className="relative bg-black/40">
              {product.coverUrl && (
                <img
                  src={product.coverUrl}
                  alt={`${product.title} cover`}
                  className="h-full max-h-[60vh] w-full object-contain lg:max-h-[90vh]"
                />
              )}
              <div className="absolute left-3 top-3 flex flex-col gap-1.5">
                <span className="rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium text-secondary-text backdrop-blur">
                  {product.license}
                </span>
                {isFree && (
                  <span className="rounded-full border border-success/40 bg-success/20 px-2.5 py-1 text-[11px] font-semibold text-success backdrop-blur">
                    Free pack
                  </span>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="flex flex-col gap-5 p-6">
              {/* Title + creator */}
              <div>
                <h2 className="font-display text-xl font-semibold text-foreground">
                  {product.title}
                </h2>
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {creatorName.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 truncate text-sm font-medium text-foreground">
                      {creatorName}
                      {product.creator.verified && (
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Verified creator" />
                      )}
                    </p>
                    <p className="truncate text-xs text-secondary-text">
                      @{product.creator.username ?? "wallora"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {product.description && (
                <p className="text-sm leading-relaxed text-secondary-text">
                  {product.description}
                </p>
              )}

              {/* Price block */}
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-secondary-text">
                      Price
                    </p>
                    <p className={cn(
                      "mt-1 font-display text-2xl font-semibold",
                      isFree ? "text-success" : "text-primary",
                    )}>
                      {priceLabel}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium uppercase tracking-wider text-secondary-text">
                      Purchases
                    </p>
                    <p className="mt-1 flex items-center justify-end gap-1 text-sm font-semibold text-foreground">
                      <Users className="h-3.5 w-3.5 text-secondary-text" />
                      {product.purchaseCount}
                    </p>
                  </div>
                </div>
              </div>

              {/* Purchase / owned CTA */}
              {product.owned ? (
                <div className="rounded-lg border border-success/40 bg-success/10 p-4">
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    <p className="text-sm font-semibold">In your library</p>
                  </div>
                  <p className="mt-1 text-xs text-secondary-text">
                    You already own this pack. {isFree ? "Free pack — no purchase required." : "Re-download anytime."}
                  </p>
                </div>
              ) : (
                <Button
                  size="lg"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold-glow"
                  onClick={handlePurchase}
                  disabled={purchaseMutation.isPending}
                >
                  {purchaseMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      {isFree ? "Add to library (Free)" : `Purchase ${priceLabel}`}
                    </>
                  )}
                </Button>
              )}

              {/* Demo notice */}
              <div className="rounded-lg border border-border bg-surface p-3">
                <p className="flex items-start gap-2 text-xs leading-relaxed text-secondary-text">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary-text" />
                  <span>
                    <span className="font-medium text-foreground">Demo purchase flow.</span>{" "}
                    No real payment gateway is wired up — purchases are recorded as
                    completed so the entitlement flow can be demonstrated honestly.
                  </span>
                </p>
              </div>

              <Separator className="bg-border" />

              {/* Metadata */}
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <MetaRow icon={ShieldCheck} label="License" value={product.license} />
                <MetaRow icon={Tag} label="Type" value={isFree ? "Free pack" : "Paid pack"} />
                <MetaRow
                  icon={Users}
                  label="Purchases"
                  value={String(product.purchaseCount)}
                />
                <MetaRow
                  icon={Store}
                  label="Listed"
                  value={new Date(product.createdAt).toLocaleDateString()}
                />
              </dl>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Loading / empty / error states
// ---------------------------------------------------------------------------

function MarketplaceSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-border bg-surface"
        >
          <Skeleton className="aspect-[4/3] w-full rounded-none bg-raised" />
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-4 w-3/4 bg-raised" />
            <Skeleton className="h-3 w-1/2 bg-raised" />
            <Skeleton className="mt-2 h-px w-full bg-border" />
            <Skeleton className="h-3 w-1/3 bg-raised" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MarketplaceEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface/50 py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-raised text-secondary-text">
        <PackageOpen className="h-6 w-6" />
      </span>
      <p className="font-medium text-foreground">No packs in the marketplace yet</p>
      <p className="max-w-sm text-sm text-secondary-text">
        Verified creators haven't listed any packs. Check back once the
        storefront inventory is seeded.
      </p>
    </div>
  );
}

function MarketplaceError({
  onRetry,
  message,
}: {
  onRetry: () => void;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface/50 py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </span>
      <p className="font-medium text-foreground">{message}</p>
      <Button variant="outline" className="border-border" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
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
