"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Save,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import { useVerificationGate } from "@/components/verification/verification-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const LICENSES = ["Personal", "Commercial", "Extended"] as const;
type License = (typeof LICENSES)[number];

export default function NewListingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { guard } = useVerificationGate();

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState("0");
  const [license, setLicense] = React.useState<License>("Personal");
  const [coverUrl, setCoverUrl] = React.useState("");
  const [coverFile, setCoverFile] = React.useState<File | null>(null);
  const [coverPreview, setCoverPreview] = React.useState<string | null>(null);
  const [isPublished, setIsPublished] = React.useState(true);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    return () => {
      if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const create = useMutation({
    mutationFn: async () => {
      const cents = Math.round(Number(price) * 100);
      let url = coverUrl.trim() || null;
      if (coverFile) {
        const form = new FormData();
        form.append("file", coverFile);
        const uploadRes = await fetch("/api/v1/products/image", { method: "POST", body: form });
        const uploadBody = await uploadRes.json().catch(() => null);
        if (!uploadRes.ok) {
          throw new Error(uploadBody?.error?.message ?? "Cover upload failed.");
        }
        url = (uploadBody.data?.url ?? uploadBody.url) as string;
      }
      const res = await fetch("/api/v1/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          price: cents,
          license,
          coverUrl: url,
          isPublished,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not create listing.");
      return body;
    },
    onSuccess: () => {
      toast.success(isPublished ? "Listing published" : "Draft saved", {
        description: isPublished ? "Your pack is live in the marketplace." : "Publish it any time from Manage listings.",
      });
      router.push("/marketplace/manage");
      router.refresh();
    },
    onError: (err: Error) => toast.error("Could not save listing", { description: err.message }),
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
    guard(() => create.mutate(), { action: "publish a marketplace listing" });
  };

  const onPickFile = (file: File | null) => {
    if (!file) return;
    if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setCoverUrl("");
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-secondary-text hover:text-foreground">
          <Link href="/marketplace/manage"><ArrowLeft className="size-4" /> My listings</Link>
        </Button>

        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">Seller tools</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-foreground sm:text-3xl">Create a listing</h1>
          <p className="mt-2 text-sm text-secondary-text">
            Add a real pack with a clear license and price. You can edit, unpublish or delete it any time.
          </p>
        </div>

        <form onSubmit={submit} className="mt-7 space-y-5 rounded-2xl border border-border bg-surface p-5 sm:p-7">
          <div className="space-y-1.5">
            <Label htmlFor="listing-title">Title</Label>
            <Input
              id="listing-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Neon Horizon — 12 wallpapers"
              maxLength={120}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="listing-description">Description</Label>
            <Textarea
              id="listing-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What's included, formats, resolution and usage terms."
              rows={5}
              maxLength={2000}
            />
            <p className="text-right text-[11px] text-secondary-text">{description.length}/2000</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="listing-price">Price (USD)</Label>
              <Input
                id="listing-price"
                type="number"
                min="0"
                max="100000"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                required
              />
              <p className="text-[11px] text-secondary-text">
                Stored as {Math.round(Number(price) * 100 || 0)} cents. Use 0 for a free pack.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>License</Label>
              <Select value={license} onValueChange={(value) => setLicense(value as License)}>
                <SelectTrigger className="w-full border-border bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LICENSES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cover image</Label>
            <div className="flex flex-wrap items-start gap-4">
              <div className="relative h-28 w-44 shrink-0 overflow-hidden rounded-xl border border-border bg-raised">
                {(coverPreview ?? coverUrl) ? (
                  <img src={coverPreview ?? coverUrl} alt="Cover preview" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-secondary-text">
                    <ImagePlus className="size-6" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => onPickFile(event.target.files?.[0] ?? null)}
                />
                <Button type="button" variant="outline" className="border-border" onClick={() => fileRef.current?.click()}>
                  <UploadCloud className="size-4" /> Upload cover
                </Button>
                <Input
                  value={coverUrl}
                  onChange={(event) => {
                    setCoverUrl(event.target.value);
                    setCoverFile(null);
                    setCoverPreview(null);
                  }}
                  placeholder="Or paste an image URL"
                  aria-label="Cover image URL"
                />
                <p className="text-[11px] text-secondary-text">JPEG, PNG or WebP. Uploads are normalized and stored in WALLORA.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-raised/40 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Publish now</p>
              <p className="text-xs text-secondary-text">Unpublished listings stay in your manager only.</p>
            </div>
            <Switch checked={isPublished} onCheckedChange={setIsPublished} aria-label="Publish listing" />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-border bg-raised/30 p-3 text-xs text-secondary-text">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              Creating and publishing require a verified WALLORA account. Purchases in this demo
              record real entitlements; no payment gateway is connected.
            </span>
          </div>

          {session?.user ? null : (
            <p className="text-xs text-secondary-text">You&apos;ll be asked to sign in before saving.</p>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" asChild>
              <Link href="/marketplace">Cancel</Link>
            </Button>
            <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {isPublished ? "Publish listing" : "Save draft"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
