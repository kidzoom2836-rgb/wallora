"use client";

import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  UploadIcon,
  LoaderIcon,
  CheckCircleIcon,
  AlertIcon,
  CloseIcon,
  PlusIcon,
  ArrowDownIcon,
} from "@/components/icons/wallora-icons";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUploadDialog } from "@/stores/upload";
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_VARIATIONS,
  MIN_DIMENSION,
  createVariationId,
  validateClientImage,
} from "@/lib/upload-config";
import { defaultVariationLabel } from "@/lib/wallpaper-variants";

type CategoryItem = { id: string; slug: string; name: string };

type Step = "select" | "metadata" | "uploading" | "result" | "error";

type VariationItem = {
  id: string;
  file: File;
  previewUrl: string;
  label: string;
};

type UploadResult = {
  id: string;
  slug: string;
  title: string;
  status: string;
  orientation: string;
  dominantColor: string;
  assets: { variant: string; objectKey: string; width: number; height: number; fileSize: number; format: string }[];
  variationCount?: number;
  variations?: {
    index: number;
    label: string;
    previewAsset?: { objectKey: string } | null;
  }[];
  moderationNote: string;
};

type PresignUpload = {
  index: number;
  key: string;
  uploadId: string;
  uploadUrl: string;
  method: string;
  fields: Record<string, string>;
  headers: Record<string, string>;
  adapterType: string;
  maxBytes: number;
};

export function UploadDialog() {
  const { open, setOpen } = useUploadDialog();

  const [step, setStep] = React.useState<Step>("select");
  const [variations, setVariations] = React.useState<VariationItem[]>([]);
  const [title, setTitle] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [tagsInput, setTagsInput] = React.useState("");
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState<UploadResult | null>(null);
  const [progress, setProgress] = React.useState(0);

  const previewUrls = React.useRef<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const releasePreviews = React.useCallback(() => {
    for (const url of previewUrls.current) URL.revokeObjectURL(url);
    previewUrls.current = [];
  }, []);

  const reset = React.useCallback(() => {
    releasePreviews();
    setStep("select");
    setVariations([]);
    setTitle("");
    setCategoryId("");
    setDescription("");
    setTagsInput("");
    setError("");
    setResult(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [releasePreviews]);

  React.useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  React.useEffect(() => releasePreviews, [releasePreviews]);

  // Fetch categories for the select
  const { data: categoriesData } = useQuery<{ data: CategoryItem[] }>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/v1/categories");
      return res.json();
    },
    enabled: open,
  });
  const categories = categoriesData?.data ?? [];

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setTimeout(reset, 250);
  };

  const handleFiles = React.useCallback(
    async (files: FileList | File[]) => {
      const incoming = Array.from(files);
      if (!incoming.length) return;

      const messages: string[] = [];
      const seen = new Set(
        variations.map((v) => `${v.file.name}:${v.file.size}:${v.file.lastModified}`),
      );
      const accepted: VariationItem[] = [];

      for (const file of incoming) {
        if (variations.length + accepted.length >= MAX_VARIATIONS) {
          messages.push(`A post supports at most ${MAX_VARIATIONS} variations.`);
          break;
        }
        const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
        if (seen.has(fingerprint)) {
          messages.push(`${file.name} is already selected.`);
          continue;
        }
        const check = await validateClientImage(file);
        if (!check.ok) {
          messages.push(`${file.name}: ${check.error}`);
          continue;
        }
        seen.add(fingerprint);
        const previewUrl = URL.createObjectURL(file);
        previewUrls.current.push(previewUrl);
        accepted.push({ id: createVariationId(), file, previewUrl, label: "" });
      }

      setError(messages.slice(0, 2).join(" "));
      if (!accepted.length) return;

      setVariations((prev) => [...prev, ...accepted]);
      setStep("metadata");
      setTitle((prev) =>
        prev || accepted[0].file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      );
    },
    [variations],
  );

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      void handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const removeVariation = React.useCallback(
    (id: string) => {
      const target = variations.find((v) => v.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        previewUrls.current = previewUrls.current.filter((url) => url !== target.previewUrl);
      }
      const next = variations.filter((v) => v.id !== id);
      setVariations(next);
      if (!next.length) {
        setError("");
        setStep("select");
      }
    },
    [variations],
  );

  const moveVariation = React.useCallback(
    (id: string, direction: -1 | 1) => {
      const index = variations.findIndex((v) => v.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= variations.length) return;
      const next = [...variations];
      [next[index], next[target]] = [next[target], next[index]];
      setVariations(next);
    },
    [variations],
  );

  const setVariationLabel = React.useCallback((id: string, label: string) => {
    setVariations((prev) =>
      prev.map((variation) => (variation.id === id ? { ...variation, label } : variation)),
    );
  }, []);

  // Upload mutation: presign (batch) → upload each source → complete (one post)
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!variations.length) throw new Error("No images selected");

      setStep("uploading");
      setProgress(10);

      const presignRes = await fetch("/api/v1/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: variations.map((variation) => ({
            filename: variation.file.name,
            contentType: variation.file.type,
            size: variation.file.size,
          })),
          filename: variations[0].file.name,
          contentType: variations[0].file.type,
          size: variations[0].file.size,
        }),
      });
      if (!presignRes.ok) {
        const err = await presignRes.json();
        throw new Error(err?.error?.message ?? "Presign failed");
      }
      const presign = await presignRes.json();
      const uploads: PresignUpload[] =
        presign.data.uploads?.length ? presign.data.uploads : [presign.data];
      setProgress(15);

      const sources: { key: string; filename: string; label?: string }[] = [];
      for (const [index, upload] of uploads.entries()) {
        const variation = variations[index];
        if (!variation) break;
        const formData = new FormData();
        Object.entries(upload.fields ?? {}).forEach(([key, value]) =>
          formData.append(key, String(value)),
        );
        formData.append("file", variation.file);
        const uploadRes = await fetch(upload.uploadUrl, { method: "POST", body: formData });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error(err?.error?.message ?? "Upload failed");
        }
        const uploadData = await uploadRes.json();
        sources.push({
          key: uploadData.data?.key ?? upload.key,
          filename: variation.file.name,
          label: variation.label || undefined,
        });
        setProgress(15 + Math.round(((index + 1) / uploads.length) * 30));
      }

      const tags = tagsInput
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length >= 2);

      setProgress(70);
      const completeRes = await fetch("/api/v1/uploads/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources,
          groupId: presign.data.groupId,
          key: sources[0]?.key,
          filename: sources[0]?.filename ?? variations[0].file.name,
          title,
          categoryId,
          description: description || undefined,
          tags,
        }),
      });

      if (!completeRes.ok) {
        const err = await completeRes.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? "Processing failed");
      }

      const completeData = await completeRes.json();
      setProgress(100);
      return completeData.data as UploadResult;
    },
    onSuccess: (data) => {
      setResult(data);
      setStep("result");
      toast.success("Upload processed", {
        description: `${data.variationCount ?? 1} variation${(data.variationCount ?? 1) > 1 ? "s" : ""} pending review.`,
      });
    },
    onError: (err: Error) => {
      setError(err.message);
      setStep("error");
    },
  });

  const canSubmit = variations.length > 0 && title.trim().length >= 2 && !!categoryId;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-border bg-background sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {step === "result" ? "Upload complete" : step === "error" ? "Upload failed" : "Upload a wallpaper"}
          </DialogTitle>
          <DialogDescription className="text-secondary-text">
            {step === "result"
              ? "Your wallpaper has been processed and is pending review."
              : step === "error"
                ? "Something went wrong during the upload."
                : `Add 1–${MAX_VARIATIONS} variations in one post. We generate responsive assets and strip EXIF metadata.`}
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_MIME_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files ?? []);
            e.target.value = "";
          }}
        />

        {/* Step: Select */}
        {step === "select" && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface/60 p-10 text-center transition-colors hover:border-primary/40"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UploadIcon size={28} />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Drop 1–{MAX_VARIATIONS} images here</p>
              <p className="mt-0.5 text-xs text-secondary-text">or click to browse</p>
            </div>
            <p className="text-[11px] text-secondary-text">
              JPEG, PNG, WebP · up to {MAX_UPLOAD_BYTES / 1024 / 1024} MB each · min {MIN_DIMENSION}×{MIN_DIMENSION}
            </p>
            <Button
              type="button"
              variant="outline"
              className="border-border bg-raised"
              onClick={() => fileInputRef.current?.click()}
            >
              <PlusIcon size={16} className="mr-1.5" />
              Choose images
            </Button>
            {error && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertIcon size={14} />
                {error}
              </p>
            )}
          </div>
        )}

        {/* Step: Metadata */}
        {step === "metadata" && variations.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-secondary-text">
                  Variations ({variations.length}/{MAX_VARIATIONS})
                </Label>
                {variations.length < MAX_VARIATIONS && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    <PlusIcon size={12} />
                    Add another
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {variations.map((variation, index) => (
                  <div
                    key={variation.id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2"
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-raised">
                      <img
                        src={variation.previewUrl}
                        alt={variation.file.name}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <span className="absolute left-1 top-1 rounded bg-background/85 px-1 text-[9px] text-foreground">
                        {index + 1}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {variation.label || defaultVariationLabel(index)}
                      </p>
                      <p className="truncate text-[10px] text-secondary-text">
                        {(variation.file.size / 1024).toFixed(0)} KB · {variation.file.type.replace("image/", "").toUpperCase()}
                      </p>
                      <Input
                        value={variation.label}
                        onChange={(e) => setVariationLabel(variation.id, e.target.value)}
                        placeholder={defaultVariationLabel(index)}
                        maxLength={80}
                        className="mt-1 h-7 border-border bg-raised text-[11px]"
                        aria-label={`Label for variation ${index + 1}`}
                      />
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => moveVariation(variation.id, -1)}
                        disabled={index === 0}
                        className="rounded border border-border p-1 text-secondary-text hover:text-foreground disabled:opacity-30"
                        aria-label={`Move variation ${index + 1} up`}
                      >
                        <ArrowDownIcon size={12} className="rotate-180" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveVariation(variation.id, 1)}
                        disabled={index === variations.length - 1}
                        className="rounded border border-border p-1 text-secondary-text hover:text-foreground disabled:opacity-30"
                        aria-label={`Move variation ${index + 1} down`}
                      >
                        <ArrowDownIcon size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeVariation(variation.id)}
                        className="rounded border border-border p-1 text-secondary-text hover:text-destructive"
                        aria-label={`Remove variation ${index + 1}`}
                      >
                        <CloseIcon size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {error && (
                <p className="flex items-start gap-1.5 text-xs text-destructive">
                  <AlertIcon size={14} className="mt-0.5" />
                  {error}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium text-secondary-text">Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your wallpaper a title"
                className="border-border bg-surface"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium text-secondary-text">Category *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="border-border bg-surface">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent className="border-border bg-popover">
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium text-secondary-text">
                Description <span className="text-secondary-text/60">(optional)</span>
              </Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Describe your wallpaper…"
                className="resize-none border-border bg-surface"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium text-secondary-text">
                Tags <span className="text-secondary-text/60">(optional, comma-separated)</span>
              </Label>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="dark, cinematic, nature"
                className="border-border bg-surface"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" className="text-secondary-text" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!canSubmit}
                onClick={() => uploadMutation.mutate()}
              >
                <UploadIcon size={16} className="mr-1.5" />
                Upload & process
              </Button>
            </div>
          </div>
        )}

        {/* Step: Uploading */}
        {step === "uploading" && (
          <div className="flex flex-col items-center gap-5 py-8">
            <LoaderIcon size={40} className="animate-spin text-primary" />
            <div className="w-full">
              <div className="mb-2 flex items-center justify-between text-xs text-secondary-text">
                <span>Processing images…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <p className="text-center text-xs text-secondary-text">
              Generating responsive assets, stripping EXIF, extracting metadata…
            </p>
          </div>
        )}

        {/* Step: Result */}
        {step === "result" && result && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircleIcon size={28} />
              </span>
              <p className="text-sm font-medium text-foreground">{result.title}</p>
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/10 text-[11px] text-primary"
              >
                Pending review
              </Badge>
              {(result.variationCount ?? 1) > 1 && (
                <p className="text-[11px] text-secondary-text">
                  {result.variationCount} variations in one post
                </p>
              )}
            </div>

            {result.assets[0] && (
              <div className="overflow-hidden rounded-lg border border-border">
                <img
                  src={result.assets.find((a) => a.variant === "grid")?.objectKey ?? result.assets[0].objectKey}
                  alt={result.title}
                  className="aspect-video w-full object-cover"
                />
              </div>
            )}

            {(result.variations?.length ?? 0) > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {result.variations?.map((variation) =>
                  variation.previewAsset ? (
                    <img
                      key={variation.index}
                      src={variation.previewAsset.objectKey}
                      alt={variation.label}
                      className="h-14 w-20 shrink-0 rounded-md border border-border object-cover"
                    />
                  ) : null,
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-border bg-surface p-2">
                <p className="text-secondary-text">Status</p>
                <p className="font-medium text-foreground capitalize">{result.status}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-2">
                <p className="text-secondary-text">Variants</p>
                <p className="font-medium text-foreground">{result.assets.length} generated</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-2">
                <p className="text-secondary-text">Orientation</p>
                <p className="font-medium text-foreground capitalize">{result.orientation}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-2">
                <p className="text-secondary-text">Color</p>
                <p className="flex items-center gap-1.5 font-medium text-foreground">
                  <span className="h-3 w-3 rounded-full border border-border" style={{ background: result.dominantColor }} />
                  {result.dominantColor}
                </p>
              </div>
            </div>

            <p className="text-xs text-secondary-text">{result.moderationNote}</p>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" className="text-secondary-text" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button
                variant="outline"
                className="border-border bg-surface"
                onClick={reset}
              >
                <PlusIcon size={16} className="mr-1.5" />
                Upload another
              </Button>
            </div>
          </div>
        )}

        {/* Step: Error */}
        {step === "error" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <AlertIcon size={28} />
            </span>
            <p className="text-sm text-foreground">{error || "Something went wrong."}</p>
            <div className="flex gap-2">
              <Button variant="ghost" className="text-secondary-text" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button variant="outline" className="border-border bg-surface" onClick={() => setStep("metadata")}>
                Try again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
