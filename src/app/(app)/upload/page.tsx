"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import {
  UploadIcon,
  ImageIcon,
  CheckCircleIcon,
  AlertIcon,
  CloseIcon,
  PlusIcon,
  LoaderIcon,
  ArrowRightIcon,
  SparklesIcon,
  TagIcon,
} from "@/components/icons/wallora-icons";
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
import { useVerificationGate } from "@/components/verification/verification-gate";
import { cn } from "@/lib/utils";

type CategoryItem = {
  id: string;
  slug: string;
  name: string;
};

type Step = "select" | "metadata" | "uploading" | "result" | "error";

type UploadResult = {
  id: string;
  slug: string;
  title: string;
  status: string;
  orientation: string;
  dominantColor: string;
  license: string;
  createdAt: string;
  assets: {
    variant: string;
    objectKey: string;
    width: number;
    height: number;
    fileSize: number;
    format: string;
  }[];
  moderationNote: string;
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;
const MIN_DIMENSION = 512;

/**
 * Dedicated upload page for WALLORA.
 *
 * Full-page, multi-step flow with the same upload pipeline as the dialog:
 *   presign → upload-to-receive → complete
 *
 * The pipeline captures the key returned by the receive endpoint
 * (`effectiveKey`) so the Blob adapter — which returns the public URL as
 * the key — is supported transparently.
 */
export default function UploadPage() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoaderIcon size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return <SignInGate />;
  }

  return <UploadFlow />;
}

/* -------------------------------------------------------------------------- */
/* Sign-in gate                                                               */
/* -------------------------------------------------------------------------- */

function SignInGate() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-12 text-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full rounded-2xl border border-border bg-surface p-8 shadow-premium"
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UploadIcon size={28} />
        </span>
        <h1 className="mt-5 font-display text-xl font-semibold text-foreground">
          Sign in to upload
        </h1>
        <p className="mt-2 text-sm text-secondary-text">
          You need a WALLORA account to upload wallpapers. Sign in to continue,
          or create a free account in seconds.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/login?callbackUrl=/upload">Sign in</Link>
          </Button>
          <Button asChild variant="outline" className="border-border bg-raised">
            <Link href="/register?callbackUrl=/upload">Create account</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Upload flow                                                                */
/* -------------------------------------------------------------------------- */

function UploadFlow() {
  const { guard } = useVerificationGate();
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
  const [statusText, setStatusText] = React.useState("Uploading…");

  // Fetch categories once we reach the metadata step.
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery<{ data: CategoryItem[] }>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/v1/categories");
      if (!res.ok) throw new Error("Failed to load categories");
      return res.json();
    },
    enabled: step === "metadata",
  });
  const categories = categoriesData?.data ?? [];

  // Check storage configuration — show a setup banner if no persistent backend
  // (Blob/R2) is configured in production (the Local adapter can't persist on
  // Vercel's read-only / ephemeral filesystem).
  const { data: storageData } = useQuery<{ data: { adapterType: string } }>({
    queryKey: ["upload-storage-config"],
    queryFn: async () => {
      const res = await fetch("/api/v1/uploads/presign");
      if (!res.ok) throw new Error("Failed to check storage");
      return res.json();
    },
  });
  const storageAdapter = storageData?.data?.adapterType ?? "local";
  const storageUnconfigured =
    storageAdapter === "local" && process.env.NODE_ENV === "production";

  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
    setStatusText("Uploading…");
  }, [previewUrl]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelect = React.useCallback((selected: File | null) => {
    if (!selected) return;
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError("Only JPEG, PNG and WebP images are allowed.");
      setStep("error");
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError("File exceeds the 10 MB limit.");
      setStep("error");
      return;
    }
    // Validate minimum dimensions by loading the image briefly.
    const url = URL.createObjectURL(selected);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width < MIN_DIMENSION || img.height < MIN_DIMENSION) {
        setError(`Image must be at least ${MIN_DIMENSION}×${MIN_DIMENSION} pixels.`);
        setStep("error");
        return;
      }
      setError("");
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setStep("metadata");
      const nameWithoutExt = selected.name.replace(/\.[^.]+$/, "");
      setTitle(
        nameWithoutExt
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("Could not read the selected image.");
      setStep("error");
    };
    img.src = url;
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFileSelect(e.dataTransfer.files[0] ?? null);
    },
    [handleFileSelect],
  );

  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };

  /* ---------------------------- upload mutation --------------------------- */
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");

      setStep("uploading");
      setProgress(0);
      setStatusText("Uploading…");

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
        const err = await presignRes.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? "Presign failed");
      }
      const presign = await presignRes.json();
      const { key, uploadUrl, fields } = presign.data;
      setProgress(15);

      // 2. Upload the file to the receive endpoint (local + blob) or to R2
      //    via presigned POST — same multipart shape in all cases.
      const formData = new FormData();
      Object.entries(fields).forEach(([k, v]) => formData.append(k, v as string));
      formData.append("file", file);
      const uploadRes = await fetch(uploadUrl, { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? "Upload failed");
      }
      // IMPORTANT: the receive endpoint returns the stored key, which for
      // the Blob adapter is the public URL — not the presign key.
      const uploadData = await uploadRes.json();
      const effectiveKey = uploadData.data?.key ?? key;
      setProgress(45);
      setStatusText("Processing variants…");

      // 3. Complete (Sharp processing + DB records)
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length >= 2);

      setProgress(70);
      setStatusText("Finalizing…");
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
      setError(err.message || "Something went wrong.");
      setStep("error");
      toast.error("Upload failed", { description: err.message });
    },
  });

  const canSubmit = !!file && title.trim().length >= 2 && !!categoryId;

  /* ------------------------------- render --------------------------------- */
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
          <SparklesIcon size={14} />
          <span>Creator studio</span>
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Upload a wallpaper
        </h1>
        <p className="max-w-2xl text-sm text-secondary-text">
          Share your work with the WALLORA community. We generate responsive
          variants, strip EXIF metadata, and extract dominant color
          automatically. All uploads are reviewed before appearing in discovery.
        </p>
      </header>

      {storageUnconfigured && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <AlertIcon size={14} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Storage not configured</p>
            <p className="mt-1 text-xs text-secondary-text">
              Uploads need a storage backend to persist files. Create a{" "}
              <strong className="text-foreground">Vercel Blob store</strong> in the Vercel
              dashboard (Storage &rarr; Blob &rarr; Create) and link it to this project &mdash;
              Vercel sets the <code className="rounded bg-raised px-1 py-0.5 text-[10px]">BLOB_READ_WRITE_TOKEN</code>{" "}
              automatically. Then redeploy and uploads will work immediately.
            </p>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {step === "select" && (
            <SelectStep
              onDrop={handleDrop}
              onClick={handleDropZoneClick}
              onSelect={handleFileSelect}
              inputRef={fileInputRef}
            />
          )}

          {step === "metadata" && file && previewUrl && (
            <MetadataStep
              file={file}
              previewUrl={previewUrl}
              title={title}
              setTitle={setTitle}
              categoryId={categoryId}
              setCategoryId={setCategoryId}
              description={description}
              setDescription={setDescription}
              tagsInput={tagsInput}
              setTagsInput={setTagsInput}
              categories={categories}
              categoriesLoading={categoriesLoading}
              canSubmit={canSubmit}
              onCancel={reset}
              onSubmit={() => guard(() => uploadMutation.mutate(), { action: "publish a wallpaper" })}
              onRemove={() => reset()}
            />
          )}

          {step === "uploading" && (
            <UploadingStep progress={progress} statusText={statusText} />
          )}

          {step === "result" && result && (
            <ResultStep result={result} onReset={reset} />
          )}

          {step === "error" && (
            <ErrorStep
              message={error}
              onRetry={() => {
                if (file) setStep("metadata");
                else reset();
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                      */
/* -------------------------------------------------------------------------- */

type SelectStepProps = {
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
  onSelect: (file: File | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
};

function SelectStep({ onDrop, onClick, onSelect, inputRef }: SelectStepProps) {
  const [dragging, setDragging] = React.useState(false);

  return (
    <section className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div
          onDrop={(e) => {
            setDragging(false);
            onDrop(e);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onClick={onClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick();
            }
          }}
          aria-label="Drop an image or click to browse"
          className={cn(
            "flex min-h-[340px] cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed bg-surface/60 p-10 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-surface",
          )}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary shadow-gold-glow">
            <UploadIcon size={30} />
          </span>
          <div>
            <p className="font-display text-base font-semibold text-foreground">
              Drop an image here
            </p>
            <p className="mt-1 text-sm text-secondary-text">or click to browse</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-secondary-text">
            <Badge variant="outline" className="border-border bg-raised text-secondary-text">
              JPEG
            </Badge>
            <Badge variant="outline" className="border-border bg-raised text-secondary-text">
              PNG
            </Badge>
            <Badge variant="outline" className="border-border bg-raised text-secondary-text">
              WebP
            </Badge>
            <span className="text-secondary-text/80">· up to 10 MB · min 512×512</span>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      <aside className="lg:col-span-2">
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <SparklesIcon size={16} className="text-primary" />
            What happens next
          </div>
          <ol className="mt-4 flex flex-col gap-4 text-sm text-secondary-text">
            <PipelineStep
              index={1}
              title="Validate"
              desc="We check the file type, size, and minimum dimensions."
            />
            <PipelineStep
              index={2}
              title="Process"
              desc="Sharp generates responsive variants and strips EXIF metadata."
            />
            <PipelineStep
              index={3}
              title="Extract"
              desc="We capture orientation, dominant color, and asset dimensions."
            />
            <PipelineStep
              index={4}
              title="Review"
              desc="Your wallpaper enters the moderation queue for approval."
            />
          </ol>
        </div>
      </aside>
    </section>
  );
}

function PipelineStep({
  index,
  title,
  desc,
}: {
  index: number;
  title: string;
  desc: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-raised text-[11px] font-semibold text-primary">
        {index}
      </span>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-secondary-text">{desc}</p>
      </div>
    </li>
  );
}

type MetadataStepProps = {
  file: File;
  previewUrl: string;
  title: string;
  setTitle: (v: string) => void;
  categoryId: string;
  setCategoryId: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  tagsInput: string;
  setTagsInput: (v: string) => void;
  categories: CategoryItem[];
  categoriesLoading: boolean;
  canSubmit: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  onRemove: () => void;
};

function MetadataStep({
  file,
  previewUrl,
  title,
  setTitle,
  categoryId,
  setCategoryId,
  description,
  setDescription,
  tagsInput,
  setTagsInput,
  categories,
  categoriesLoading,
  canSubmit,
  onCancel,
  onSubmit,
  onRemove,
}: MetadataStepProps) {
  return (
    <section className="grid gap-6 lg:grid-cols-5">
      {/* Left: preview + file info */}
      <div className="lg:col-span-2">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="relative aspect-square w-full overflow-hidden bg-raised">
            <img
              src={previewUrl}
              alt={file.name}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={onRemove}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/80 text-secondary-text backdrop-blur transition-colors hover:text-foreground"
              aria-label="Remove file"
            >
              <CloseIcon size={16} />
            </button>
          </div>
          <div className="flex items-start gap-3 border-t border-border p-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-raised text-secondary-text">
              <ImageIcon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground" title={file.name}>
                {file.name}
              </p>
              <p className="mt-0.5 text-xs text-secondary-text">
                {(file.size / 1024).toFixed(0)} KB · {file.type.replace("image/", "").toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right: metadata form */}
      <div className="lg:col-span-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onSubmit();
          }}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="upload-title" className="text-xs font-medium uppercase tracking-wide text-secondary-text">
              Title <span className="text-primary">*</span>
            </Label>
            <Input
              id="upload-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your wallpaper a title"
              className="border-border bg-raised"
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="upload-category" className="text-xs font-medium uppercase tracking-wide text-secondary-text">
              Category <span className="text-primary">*</span>
            </Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="upload-category" className="border-border bg-raised">
                <SelectValue
                  placeholder={categoriesLoading ? "Loading categories…" : "Select a category"}
                />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover">
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="upload-description" className="text-xs font-medium uppercase tracking-wide text-secondary-text">
              Description{" "}
              <span className="text-secondary-text/60">(optional)</span>
            </Label>
            <Textarea
              id="upload-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe your wallpaper…"
              className="resize-none border-border bg-raised"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="upload-tags" className="text-xs font-medium uppercase tracking-wide text-secondary-text">
              Tags{" "}
              <span className="text-secondary-text/60">(optional, comma-separated)</span>
            </Label>
            <div className="relative">
              <TagIcon
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary-text"
              />
              <Input
                id="upload-tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="dark, cinematic, nature"
                className="border-border bg-raised pl-9"
              />
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="ghost"
              className="text-secondary-text hover:text-foreground"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!canSubmit}
            >
              <UploadIcon size={16} className="mr-1.5" />
              Upload & process
              <ArrowRightIcon size={16} className="ml-1.5" />
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

function UploadingStep({ progress, statusText }: { progress: number; statusText: string }) {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-6 rounded-2xl border border-border bg-surface p-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <LoaderIcon size={30} className="animate-spin" />
      </span>
      <div className="w-full">
        <div className="mb-2 flex items-center justify-between text-xs text-secondary-text">
          <span className="font-medium text-foreground">{statusText}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-raised">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <p className="max-w-sm text-xs text-secondary-text">
        Generating responsive variants, stripping EXIF, extracting metadata.
        This usually takes a few seconds.
      </p>
    </section>
  );
}

function ResultStep({ result, onReset }: { result: UploadResult; onReset: () => void }) {
  const gridAsset =
    result.assets.find((a) => a.variant === "grid") ?? result.assets[0];

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircleIcon size={30} />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            {result.title}
          </h2>
          <p className="mt-1 text-sm text-secondary-text">
            Your upload has been processed and is pending review.
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-primary/30 bg-primary/10 text-[11px] text-primary"
        >
          Pending review
        </Badge>
      </div>

      {gridAsset && (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <img
            src={gridAsset.objectKey}
            alt={result.title}
            className="aspect-video w-full object-cover"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <InfoCard label="Status" value={<span className="capitalize">{result.status}</span>} />
        <InfoCard
          label="Variants"
          value={`${result.assets.length} generated`}
        />
        <InfoCard
          label="Orientation"
          value={<span className="capitalize">{result.orientation}</span>}
        />
        <InfoCard
          label="Dominant color"
          value={
            <span className="flex items-center gap-1.5">
              <span
                className="h-3 w-3 rounded-full border border-border"
                style={{ background: result.dominantColor }}
              />
              {result.dominantColor}
            </span>
          }
        />
      </div>

      {result.moderationNote && (
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-xs text-secondary-text">
          {result.moderationNote}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" className="border-border bg-surface">
          <Link href="/discover">Close</Link>
        </Button>
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={onReset}
        >
          <PlusIcon size={16} className="mr-1.5" />
          Upload another
        </Button>
      </div>
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-secondary-text">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function ErrorStep({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-5 rounded-2xl border border-border bg-surface p-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <AlertIcon size={30} />
      </span>
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">
          Upload failed
        </h2>
        <p className="mt-1.5 text-sm text-secondary-text">
          {message || "Something went wrong during the upload."}
        </p>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline" className="border-border bg-surface">
          <Link href="/discover">Close</Link>
        </Button>
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={onRetry}
        >
          Try again
        </Button>
      </div>
    </section>
  );
}
