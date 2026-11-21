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
import { cn } from "@/lib/utils";

type CategoryItem = { id: string; slug: string; name: string };

type Step = "select" | "metadata" | "uploading" | "result" | "error";

type UploadResult = {
  id: string;
  slug: string;
  title: string;
  status: string;
  orientation: string;
  dominantColor: string;
  assets: { variant: string; objectKey: string; width: number; height: number; fileSize: number; format: string }[];
  moderationNote: string;
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

export function UploadDialog() {
  const { open, setOpen } = useUploadDialog();

  const [step, setStep] = React.useState<Step>("select");
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [tagsInput, setTagsInput] = React.useState("");
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState<UploadResult | null>(null);
  const [progress, setProgress] = React.useState(0);

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

  const reset = React.useCallback(() => {
    setStep("select");
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setTitle("");
    setCategoryId("");
    setDescription("");
    setTagsInput("");
    setError("");
    setResult(null);
    setProgress(0);
  }, [previewUrl]);

  React.useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setTimeout(reset, 250);
  };

  const handleFileSelect = (selected: File | null) => {
    if (!selected) return;
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError("Only JPEG, PNG and WebP images are allowed.");
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError("File exceeds the 10 MB limit.");
      return;
    }
    setError("");
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setStep("metadata");
    // Auto-fill title from filename
    const nameWithoutExt = selected.name.replace(/\.[^.]+$/, "");
    setTitle(nameWithoutExt.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files[0] ?? null);
  };

  // Upload mutation: presign → upload → complete
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");

      setStep("uploading");
      setProgress(10);

      // 1. Presign
      const presignRes = await fetch("/api/v1/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      if (!presignRes.ok) {
        const err = await presignRes.json();
        throw new Error(err?.error?.message ?? "Presign failed");
      }
      const presign = await presignRes.json();
      const { key, uploadUrl, fields } = presign.data;
      setProgress(15);

      // 2. Upload the file to the receive endpoint (local + blob adapters)
      //    For R2, this is a presigned POST direct to R2.
      const formData = new FormData();
      Object.entries(fields).forEach(([k, v]) => formData.append(k, v as string));
      formData.append("file", file);
      const uploadRes = await fetch(uploadUrl, { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? "Upload failed");
      }
      // IMPORTANT: capture the key returned by the receive endpoint — for
      // the Blob adapter, this is the public URL, not the presign key.
      const uploadData = await uploadRes.json();
      const effectiveKey = uploadData.data?.key ?? key;
      setProgress(45);

      // 3. Complete (process with Sharp, create wallpaper)
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length >= 2);

      setProgress(70);
      const completeRes = await fetch("/api/v1/uploads/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: effectiveKey,
          filename: file.name,
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
        description: "Your wallpaper is pending review.",
      });
    },
    onError: (err: Error) => {
      setError(err.message);
      setStep("error");
    },
  });

  const canSubmit = file && title.trim().length >= 2 && categoryId;

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
                : "Upload an image to the WALLORA library. We'll generate responsive variants and strip EXIF metadata."}
          </DialogDescription>
        </DialogHeader>

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
              <p className="text-sm font-medium text-foreground">Drop an image here</p>
              <p className="mt-0.5 text-xs text-secondary-text">or click to browse</p>
            </div>
            <p className="text-[11px] text-secondary-text">JPEG, PNG, WebP · up to 10 MB · min 512×512</p>
            <input
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              className="hidden"
              id="upload-file-input"
              onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
            />
            <Button
              asChild
              variant="outline"
              className="border-border bg-raised"
            >
              <label htmlFor="upload-file-input" className="cursor-pointer">
                <PlusIcon size={16} className="mr-1.5" />
                Choose file
              </label>
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
        {step === "metadata" && file && previewUrl && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
              <img
                src={previewUrl}
                alt={file.name}
                className="h-16 w-16 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-secondary-text">
                  {(file.size / 1024).toFixed(0)} KB · {file.type}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setFile(null); setPreviewUrl(null); setStep("select"); }}
                className="rounded p-1 text-secondary-text hover:text-foreground"
                aria-label="Remove file"
              >
                <CloseIcon size={16} />
              </button>
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
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
                <span>Processing image…</span>
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
              Generating responsive variants, stripping EXIF, extracting metadata…
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

            <p className="text-xs text-secondary-text">
              {result.moderationNote}
            </p>

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
