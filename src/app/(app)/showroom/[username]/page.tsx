"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  ExternalLink,
  FolderOpen,
  ImageIcon,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { VerifiedTick } from "@/components/brand/verified-badge";
import {
  ShowroomEditor,
  type ShowroomItemView,
  type ShowroomView,
} from "@/components/landing/showroom-grid";
import { useVerificationGate } from "@/components/verification/verification-gate";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type DetailResponse = { data: ShowroomView };

const SOURCE_LABEL: Record<ShowroomItemView["type"], string> = {
  wallpaper: "Wallpaper",
  project: "Project",
  image: "Image",
};

export default function ShowroomDetailPage() {
  const params = useParams<{ username: string }>();
  const username = params.username ?? "";
  const { data: session } = useSession();
  const { guard } = useVerificationGate();
  const qc = useQueryClient();
  const [editing, setEditing] = React.useState(false);

  const showroomQuery = useQuery<DetailResponse>({
    queryKey: ["showroom-detail", username],
    queryFn: async () => {
      const res = await fetch(`/api/v1/showroom/${encodeURIComponent(username)}`);
      if (!res.ok) throw new Error("not_found");
      return res.json();
    },
    enabled: !!username,
  });

  const feature = useMutation({
    mutationFn: async (item: ShowroomItemView) => {
      const mine = session?.user?.username;
      if (!mine) throw new Error("Set a profile username first.");
      const res = await fetch(`/api/v1/showroom/${encodeURIComponent(mine)}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: {
            ...(item.wallpaperSlug ? { wallpaperSlug: item.wallpaperSlug } : {}),
            ...(item.projectId ? { projectId: item.projectId } : {}),
            ...(item.type === "image" && item.imageUrl ? { imageUrl: item.imageUrl } : {}),
            caption: item.caption || item.title,
          },
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not feature this item.");
      return body;
    },
    onSuccess: () => {
      toast.success("Added to your showroom", {
        description: "Open your showroom to see it in your gallery.",
      });
      void qc.invalidateQueries({ queryKey: ["showroom-list"] });
    },
    onError: (err: Error) => toast.error("Could not feature this item", { description: err.message }),
  });

  if (showroomQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Skeleton className="h-40 w-full rounded-2xl bg-raised" />
        <div className="mt-8 columns-1 gap-4 sm:columns-2 lg:columns-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="mb-4 h-64 w-full break-inside-avoid rounded-2xl bg-raised" />
          ))}
        </div>
      </div>
    );
  }

  if (showroomQuery.isError || !showroomQuery.data?.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <LayoutGrid className="mx-auto size-9 text-secondary-text" />
        <h1 className="mt-4 font-display text-xl font-semibold">Showroom not found</h1>
        <p className="mt-2 text-sm text-secondary-text">
          This gallery may have been removed or its owner is no longer available.
        </p>
        <Button asChild className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/showroom">Back to showrooms</Link>
        </Button>
      </div>
    );
  }

  const showroom = showroomQuery.data.data;
  const ownerName = showroom.owner.displayName ?? showroom.owner.username;
  const isOwner = !!session?.user?.id && showroom.owner.userId === session.user.id;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="relative border-b border-border bg-surface">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(215,184,121,0.12),transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <Button variant="ghost" size="sm" asChild className="mb-5 -ml-2 text-secondary-text hover:text-foreground">
            <Link href="/showroom"><ArrowLeft className="size-4" /> All showrooms</Link>
          </Button>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                Showroom by @{showroom.username}
              </p>
              <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
                {showroom.headline}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-secondary-text">
                {showroom.description}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href={`/profile/${showroom.owner.username}`}
                  className="flex items-center gap-2 rounded-full border border-border bg-background/60 py-1 pl-1 pr-3 text-xs text-foreground"
                >
                  <Avatar className="size-7 border border-border">
                    <AvatarImage src={showroom.owner.avatarUrl ?? undefined} alt={ownerName} />
                    <AvatarFallback className="bg-raised text-[10px]">{ownerName.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{ownerName}</span>
                  <VerifiedTick tier={showroom.owner.tier} className="size-3.5" />
                </Link>
                <Badge variant="outline" className="border-border text-[11px] text-secondary-text">
                  {showroom.itemCount} {showroom.itemCount === 1 ? "piece" : "pieces"}
                </Badge>
              </div>
            </div>
            {isOwner && (
              <Button variant="outline" className="border-border" onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> Edit showroom
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {showroom.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface/40 py-20 text-center">
            <LayoutGrid className="mx-auto size-8 text-secondary-text" />
            <p className="mt-3 text-sm text-secondary-text">No items have been added to this showroom yet.</p>
            {isOwner && (
              <Button className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setEditing(true)}>
                <Plus className="size-4" /> Add real work
              </Button>
            )}
          </div>
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
            {showroom.items.map((item) => (
              <article
                key={item.id}
                className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-border bg-surface"
              >
                <ItemVisual item={item} />
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="border-border text-[10px] text-secondary-text">
                      {SOURCE_LABEL[item.type]}
                    </Badge>
                    {item.href && (
                      <ItemLink item={item} className="text-secondary-text hover:text-primary" aria-label={`Open ${item.title}`}>
                        <ArrowUpRight className="size-4" />
                      </ItemLink>
                    )}
                  </div>
                  <ItemLink item={item} className="mt-2 block">
                    <h2 className="line-clamp-2 text-sm font-semibold text-foreground hover:text-primary">
                      {item.title}
                    </h2>
                  </ItemLink>
                  {item.caption && item.caption !== item.title && (
                    <p className="mt-1 line-clamp-2 text-xs text-secondary-text">{item.caption}</p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full border-border text-xs"
                    onClick={() => guard(() => feature.mutate(item), { action: "feature this in your showroom" })}
                    disabled={feature.isPending}
                  >
                    {feature.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                    Feature this in my showroom
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <ShowroomEditor open={editing} onOpenChange={setEditing} existing={showroom} />
    </div>
  );
}

function ItemVisual({ item }: { item: ShowroomItemView }) {
  if (!item.href) return <ItemPlaceholder item={item} />;
  return (
    <ItemLink item={item} className="block">
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.title}
          loading="lazy"
          className="max-h-80 w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
        />
      ) : (
        <ItemPlaceholder item={item} />
      )}
    </ItemLink>
  );
}

function ItemPlaceholder({ item }: { item: ShowroomItemView }) {
  const Icon = item.type === "project" ? FolderOpen : item.type === "image" ? ImageIcon : Sparkles;
  return (
    <div className="flex h-48 items-center justify-center bg-gradient-to-br from-primary/10 via-surface to-raised text-primary">
      <Icon className="size-7" />
    </div>
  );
}

function ItemLink({
  item,
  className,
  children,
  ...rest
}: {
  item: ShowroomItemView;
  className?: string;
  children: React.ReactNode;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (!item.href) {
    return <span className={className}>{children}</span>;
  }
  const isExternal = /^https?:\/\//i.test(item.href);
  if (isExternal) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer noopener" className={className} {...rest}>
        {children}
        <ExternalLink className="ml-1 inline size-3" />
      </a>
    );
  }
  return (
    <Link href={item.href} className={className} {...rest}>
      {children}
    </Link>
  );
}
