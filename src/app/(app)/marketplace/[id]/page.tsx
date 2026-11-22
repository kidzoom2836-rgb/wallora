"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Info,
  Loader2,
  Pencil,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tag,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { VerifiedTick } from "@/components/brand/verified-badge";
import type { VerificationTier } from "@/lib/verification/store";
import { useAuthDialog } from "@/stores/auth-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ProductDetail = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  license: string;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
  purchaseCount: number;
  owned: boolean;
  creator: {
    id: string;
    username: string | null;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    verified: boolean;
    tier: VerificationTier;
  };
};

type PurchaseResponse = {
  data: {
    alreadyOwned: boolean;
    demo: { note: string; paymentProvider: string | null };
  };
};

function formatPrice(cents: number): string {
  return cents <= 0 ? "Free" : `$${(cents / 100).toFixed(2)}`;
}

export default function MarketplaceProductPage() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
  const { data: session } = useSession();
  const openSignIn = useAuthDialog((s) => s.openSignIn);
  const qc = useQueryClient();

  const productQuery = useQuery<{ data: ProductDetail }>({
    queryKey: ["marketplace-product", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/products/${id}`);
      if (!res.ok) throw new Error("not_found");
      return res.json();
    },
    enabled: !!id,
  });

  const purchase = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/products/${id}/purchase`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Purchase failed.");
      return body as PurchaseResponse;
    },
    onSuccess: (body) => {
      toast.success(body.data.alreadyOwned ? "Already in your library" : "Added to your library", {
        description: body.data.alreadyOwned
          ? "No new entitlement was created."
          : "The entitlement is recorded in WALLORA. No payment was processed.",
      });
      void qc.invalidateQueries({ queryKey: ["marketplace-product", id] });
      void qc.invalidateQueries({ queryKey: ["marketplace-products"] });
    },
    onError: (err: Error) => toast.error("Purchase failed", { description: err.message }),
  });

  if (productQuery.isLoading) {
    return (
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
        <Skeleton className="aspect-video w-full rounded-2xl bg-raised" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3 bg-raised" />
          <Skeleton className="h-4 w-full bg-raised" />
          <Skeleton className="h-24 w-full bg-raised" />
        </div>
      </div>
    );
  }

  if (productQuery.isError || !productQuery.data?.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <AlertCircle className="mx-auto size-9 text-destructive" />
        <h1 className="mt-4 font-display text-xl font-semibold">Listing not found</h1>
        <p className="mt-2 text-sm text-secondary-text">
          It may have been unpublished or removed by its creator.
        </p>
        <Button asChild className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/marketplace">Back to marketplace</Link>
        </Button>
      </div>
    );
  }

  const product = productQuery.data.data;
  const creatorName = product.creator.displayName ?? product.creator.username ?? "WALLORA";
  const isFree = product.price === 0;
  const isOwnListing = !!session?.user?.id && session.user.id === product.creator.id;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-secondary-text hover:text-foreground">
          <Link href="/marketplace"><ArrowLeft className="size-4" /> Marketplace</Link>
        </Button>

        <div className="mt-5 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="relative overflow-hidden rounded-2xl border border-border bg-raised">
              {product.coverUrl ? (
                <img src={product.coverUrl} alt={`${product.title} cover`} className="max-h-[70vh] w-full object-contain" />
              ) : (
                <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-primary/10 to-raised text-secondary-text">
                  <Store className="size-10" />
                </div>
              )}
              <div className="absolute left-3 top-3 flex gap-2">
                <Badge className="border-border bg-background/85 text-[11px] text-foreground backdrop-blur">
                  {product.license}
                </Badge>
                {isFree && (
                  <Badge className="border-success/40 bg-success/20 text-[11px] text-success backdrop-blur">
                    Free listing
                  </Badge>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-secondary-text">
              <span className="flex items-center gap-1.5"><Users className="size-3.5" /> {product.purchaseCount} purchases</span>
              <span className="flex items-center gap-1.5"><Tag className="size-3.5" /> Listed {new Date(product.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">{product.title}</h1>
              <div className="mt-3 flex items-center gap-2.5">
                <Avatar className="size-9 border border-border">
                  <AvatarImage src={product.creator.avatarUrl ?? undefined} alt={creatorName} />
                  <AvatarFallback className="bg-raised text-xs">{creatorName.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  {product.creator.username ? (
                    <Link href={`/profile/${product.creator.username}`} className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary">
                      <span className="truncate">{creatorName}</span>
                      <VerifiedTick tier={product.creator.tier} className="size-3.5 shrink-0" />
                    </Link>
                  ) : (
                    <p className="flex items-center gap-1 text-sm font-medium text-foreground">
                      {creatorName}
                      <VerifiedTick tier={product.creator.tier} className="size-3.5 shrink-0" />
                    </p>
                  )}
                  <p className="truncate text-xs text-secondary-text">@{product.creator.username ?? "wallora"}</p>
                </div>
              </div>
            </div>

            {product.description && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-secondary-text">{product.description}</p>
            )}

            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary-text">Price</p>
              <p className={cn("mt-1 font-display text-3xl font-bold", isFree ? "text-success" : "text-primary")}>
                {formatPrice(product.price)}
              </p>
              <Separator className="my-4 bg-border" />
              <div className="grid grid-cols-2 gap-3 text-xs">
                <MetaRow icon={ShieldCheck} label="License" value={product.license} />
                <MetaRow icon={Tag} label="Type" value={isFree ? "Free pack" : "Paid pack"} />
              </div>
            </div>

            {isOwnListing ? (
              <Button variant="outline" className="border-border" asChild>
                <Link href="/marketplace/manage"><Pencil className="size-4" /> Manage this listing</Link>
              </Button>
            ) : product.owned ? (
              <div className="rounded-xl border border-success/40 bg-success/10 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-success">
                  <CheckCircle2 className="size-4" /> In your library
                </p>
                <p className="mt-1 text-xs text-secondary-text">This entitlement is already recorded for your account.</p>
              </div>
            ) : (
              <Button
                size="lg"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => (session?.user ? purchase.mutate() : openSignIn())}
                disabled={purchase.isPending}
              >
                {purchase.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
                {isFree ? "Add to library (Free)" : `Purchase ${formatPrice(product.price)}`}
              </Button>
            )}

            <div className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-xs leading-relaxed text-secondary-text">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground">Demo purchase flow.</span> No payment is
                charged — there is no gateway connected. The entitlement is recorded as completed in
                WALLORA so you can access the pack in your library.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-secondary-text"><Icon className="size-3" /> {label}</p>
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  );
}
