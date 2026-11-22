"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CircleDollarSign,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UploadCloud,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { useAuthDialog } from "@/stores/auth-dialog";
import { useSession } from "next-auth/react";
import { useVerificationGate } from "@/components/verification/verification-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const LICENSES = ["Personal", "Commercial", "Extended"] as const;
type License = (typeof LICENSES)[number];

type MyProduct = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  license: string;
  coverUrl: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  purchaseCount: number;
};

function formatPrice(cents: number): string {
  return cents <= 0 ? "Free" : `$${(cents / 100).toFixed(2)}`;
}

export default function ManageListingsPage() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const { guard } = useVerificationGate();
  const openSignIn = useAuthDialog((s) => s.openSignIn);
  const [editing, setEditing] = React.useState<MyProduct | null>(null);
  const [deleting, setDeleting] = React.useState<MyProduct | null>(null);

  const listingsQuery = useQuery<{ data: { items: MyProduct[] } }>({
    queryKey: ["marketplace-mine"],
    queryFn: async () => {
      const res = await fetch("/api/v1/products/mine");
      if (!res.ok) throw new Error("Failed to load your listings");
      return res.json();
    },
    enabled: !!session?.user,
  });

  const toggle = useMutation({
    mutationFn: async (product: MyProduct) => {
      const res = await fetch(`/api/v1/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !product.isPublished }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not update listing.");
      return body;
    },
    onSuccess: (_, product) => {
      toast.success(product.isPublished ? "Listing unpublished" : "Listing published");
      void qc.invalidateQueries({ queryKey: ["marketplace-mine"] });
      void qc.invalidateQueries({ queryKey: ["marketplace-products"] });
    },
    onError: (err: Error) => toast.error("Could not update listing", { description: err.message }),
  });

  const remove = useMutation({
    mutationFn: async (product: MyProduct) => {
      const res = await fetch(`/api/v1/products/${product.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not delete listing.");
      return body;
    },
    onSuccess: () => {
      toast.success("Listing deleted", { description: "The listing and its purchase records were removed." });
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: ["marketplace-mine"] });
      void qc.invalidateQueries({ queryKey: ["marketplace-products"] });
    },
    onError: (err: Error) => toast.error("Could not delete listing", { description: err.message }),
  });

  const listings = listingsQuery.data?.data.items ?? [];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" asChild className="-ml-2 text-secondary-text hover:text-foreground">
              <Link href="/marketplace"><ArrowLeft className="size-4" /> Marketplace</Link>
            </Button>
            <h1 className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">My listings</h1>
            <p className="mt-2 text-sm text-secondary-text">
              Edit pricing and licenses, publish when you&apos;re ready, or remove a listing permanently.
            </p>
          </div>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
            <Link href="/marketplace/new"><Plus className="size-4" /> New listing</Link>
          </Button>
        </div>

        {!session?.user ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface/40 py-20 text-center">
            <AlertCircle className="mx-auto size-7 text-secondary-text" />
            <p className="mt-3 text-sm text-secondary-text">Sign in to manage your listings.</p>
            <Button className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90" onClick={openSignIn}>
              Sign in
            </Button>
          </div>
        ) : listingsQuery.isLoading ? (
          <div className="mt-8 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full rounded-xl bg-raised" />
            ))}
          </div>
        ) : listingsQuery.isError ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface/40 py-16 text-center">
            <p className="text-sm text-secondary-text">Couldn&apos;t load your listings.</p>
            <Button size="sm" className="mt-3" onClick={() => void listingsQuery.refetch()}>Try again</Button>
          </div>
        ) : listings.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface/40 py-20 text-center">
            <CircleDollarSign className="mx-auto size-8 text-secondary-text" />
            <p className="mt-3 text-sm text-secondary-text">You haven&apos;t created any listings yet.</p>
            <Button className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
              <Link href="/marketplace/new"><Plus className="size-4" /> Create your first listing</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {listings.map((product) => (
              <article
                key={product.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface p-4"
              >
                <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-raised">
                  {product.coverUrl ? (
                    <img src={product.coverUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-secondary-text">
                      <CircleDollarSign className="size-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/marketplace/${product.id}`} className="truncate font-display text-sm font-semibold text-foreground hover:text-primary">
                      {product.title}
                    </Link>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        product.isPublished
                          ? "border-success/40 text-success"
                          : "border-border text-secondary-text",
                      )}
                    >
                      {product.isPublished ? "Published" : "Draft"}
                    </Badge>
                    <Badge variant="outline" className="border-border text-[10px] text-secondary-text">
                      {product.license}
                    </Badge>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-secondary-text">
                    <span className="font-medium text-foreground">{formatPrice(product.price)}</span>
                    <span className="flex items-center gap-1"><Users className="size-3" /> {product.purchaseCount}</span>
                    <span>Updated {new Date(product.updatedAt).toLocaleDateString()}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border"
                    onClick={() => guard(() => setEditing(product), { action: "edit your listing" })}
                  >
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border"
                    disabled={toggle.isPending}
                    onClick={() => guard(() => toggle.mutate(product), { action: "update your listing" })}
                  >
                    {product.isPublished ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    {product.isPublished ? "Unpublish" : "Publish"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleting(product)}
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <EditListingDialog listing={editing} onClose={() => setEditing(null)} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent className="border-border bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-secondary-text">
              &quot;{deleting?.title}&quot; and its {deleting?.purchaseCount ?? 0} purchase records will be
              permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleting) remove.mutate(deleting);
              }}
            >
              {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete listing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditListingDialog({
  listing,
  onClose,
}: {
  listing: MyProduct | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { guard } = useVerificationGate();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState("0");
  const [license, setLicense] = React.useState<License>("Personal");
  const [coverUrl, setCoverUrl] = React.useState("");
  const [coverFile, setCoverFile] = React.useState<File | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!listing) return;
    setTitle(listing.title);
    setDescription(listing.description ?? "");
    setPrice((listing.price / 100).toFixed(2));
    setLicense(LICENSES.includes(listing.license as License) ? (listing.license as License) : "Personal");
    setCoverUrl(listing.coverUrl ?? "");
    setCoverFile(null);
  }, [listing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!listing) return;
      const cents = Math.round(Number(price) * 100);
      let url = coverUrl.trim() || null;
      if (coverFile) {
        const form = new FormData();
        form.append("file", coverFile);
        const uploadRes = await fetch("/api/v1/products/image", { method: "POST", body: form });
        const uploadBody = await uploadRes.json().catch(() => null);
        if (!uploadRes.ok) throw new Error(uploadBody?.error?.message ?? "Cover upload failed.");
        url = (uploadBody.data?.url ?? uploadBody.url) as string;
      }
      const res = await fetch(`/api/v1/products/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), price: cents, license, coverUrl: url }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not save changes.");
      return body;
    },
    onSuccess: () => {
      toast.success("Listing updated");
      onClose();
      void qc.invalidateQueries({ queryKey: ["marketplace-mine"] });
      void qc.invalidateQueries({ queryKey: ["marketplace-products"] });
    },
    onError: (err: Error) => toast.error("Could not save changes", { description: err.message }),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const cents = Math.round(Number(price) * 100);
    if (title.trim().length < 1 || title.trim().length > 120) {
      toast.error("Add a title between 1 and 120 characters.");
      return;
    }
    if (!Number.isFinite(cents) || cents < 0 || cents > 10_000_000) {
      toast.error("Price must be between $0 and $100,000.");
      return;
    }
    if (description.trim().length > 2000) {
      toast.error("Description must be at most 2000 characters.");
      return;
    }
    guard(() => save.mutate(), { action: "save your listing" });
  };

  return (
    <Dialog open={!!listing} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border-border bg-background">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Edit listing</DialogTitle>
          <DialogDescription className="text-xs text-secondary-text">
            Changes are validated and saved to your live listing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              maxLength={2000}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-price">Price (USD)</Label>
              <Input
                id="edit-price"
                type="number"
                min="0"
                max="100000"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>License</Label>
              <Select value={license} onValueChange={(value) => setLicense(value as License)}>
                <SelectTrigger className="w-full border-border bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LICENSES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Cover image</Label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setCoverFile(file);
                  setCoverUrl("");
                }}
              />
              <Button type="button" variant="outline" className="border-border" onClick={() => fileRef.current?.click()}>
                <UploadCloud className="size-4" /> Replace cover
              </Button>
              <Input
                value={coverUrl}
                onChange={(event) => {
                  setCoverUrl(event.target.value);
                  setCoverFile(null);
                }}
                placeholder="Or paste an image URL"
                aria-label="Cover image URL"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-raised/40 p-3">
            <div>
              <p className="text-sm font-medium">Published</p>
              <p className="text-xs text-secondary-text">Use the publish button in the list to change this.</p>
            </div>
            <Switch checked={listing?.isPublished ?? false} disabled aria-label="Published status" />
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
