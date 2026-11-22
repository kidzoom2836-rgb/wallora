"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import {
  UploadIcon,
  CheckCircleIcon,
  AlertIcon,
  CloseIcon,
  PlusIcon,
  LoaderIcon,
  ArrowRightIcon,
  ArrowDownIcon,
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
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_VARIATIONS,
  MIN_DIMENSION,
  createVariationId,
  validateClientImage,
} from "@/lib/upload-config";
import { defaultVariationLabel } from "@/lib/wallpaper-variants";
import { cn } from "@/lib/utils";

type CategoryItem = {
  id: string;
  slug: string;
  name: string;
};

type Step = "select" | "metadata" | "uploading" | "result" | "error";

type VariationItem = {
  id: string;
  file: File;
  previewUrl: string;
  /** Optional caption override; empty means use the positional default. */
  label: string;
};

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

type PresignResponse = {
  data: PresignUpload & {
    groupId?: string;
    count?: number;
    uploads?: PresignUpload[];
  };
};

/**
 * Dedicated upload page for WALLORA.
 *
 * One post accepts 1-3 images (crops / color edits / alternate treatments),
 * uploaded as separate source objects but stored as one Wallpaper with
 * namespaced WallpaperAsset rows. The pipeline is:
 *   presign (batch) → upload each source → complete (one post)
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

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function UploadFlow() {
  const { guard } = useVerificationGate();
  const [step, setStep] = React.useState<Step>("select");
  const [variations, setVariations] = React.useState<VariationItem[]>([]);
  const [title, setTitle] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [tagsInput, setTagsInput] = React.useState("");
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState<UploadResult | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [statusText, setStatusText] = React.useState("Uploading…");

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
    setStatusText("Uploading…");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [releasePreviews]);

  React.useEffect(() => releasePreviews, [releasePreviews]);

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

  // Show a setup banner if no persistent storage backend is configured.
  const { data: storageData } = useQuery<{ data: { adapterType: string; maxVariations?: number } }>({
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
      setTitle((prev) => prev || titleFromFilename(accepted[0].file.name));
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
      prev.map((variation) =>
        variation.id === id ? { ...variation, label } : variation,
      ),
    );
  }, []);

  /* ---------------------------- upload mutation --------------------------- */
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!variations.length) throw new Error("No images selected");

      setStep("uploading");
      setProgress(0);
      setStatusText("Preparing uploads…");

      // 1. Presign all source objects in one request.
      const presignRes = await fetch("/api/v1/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: variations.map((variation) => ({
            filename: variation.file.name,
            contentType: variation.file.type,
            size: variation.file.size,
          })),
          // Legacy fields keep older servers / proxies on the same path.
          filename: variations[0].file.name,
          contentType: variations[0].file.type,
          size: variations[0].file.size,
        }),
      });
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? "Presign failed");
      }
      const presign = (await presignRes.json()) as PresignResponse;
      const uploads = presign.data.uploads?.length
        ? presign.data.uploads
        : [presign.data];
      setProgress(10);

      // 2. Upload each source (receive endpoint for local/DB/Blob, R2 direct).
      const sources: { key: string; filename: string; label?: string }[] = [];
      for (const [index, upload] of uploads.entries()) {
        const variation = variations[index];
        if (!variation) break;
        setStatusText(`Uploading ${index + 1} of ${uploads.length}…`);

        const formData = new FormData();
        Object.entries(upload.fields ?? {}).forEach(([key, value]) =>
          formData.append(key, String(value)),
        );
        formData.append("file", variation.file);

        const uploadRes = await fetch(upload.uploadUrl, {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error(err?.error?.message ?? `Upload failed for variation ${index + 1}`);
        }
        const uploadData = await uploadRes.json();
        // The receive endpoint returns the stored key (a public URL for Blob).
        sources.push({
          key: uploadData.data?.key ?? upload.key,
          filename: variation.file.name,
          label: variation.label || undefined,
        });
        setProgress(10 + Math.round(((index + 1) / uploads.length) * 35));
      }

      // 3. Complete: Sharp processing + one wallpaper + all variation assets.
      const tags = tagsInput
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length >= 2);

      setProgress(70);
      setStatusText("Processing variants…");
      const completeRes = await fetch("/api/v1/uploads/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources,
          groupId: presign.data.groupId,
          // Legacy fields keep single-file clients compatible.
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
      setError(err.message || "Something went wrong.");
      setStep("error");
      toast.error("Upload failed", { description: err.message });
    },
  });

  const canSubmit =
    variations.length > 0 && title.trim().length >= 2 && !!categoryId;

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
          Add up to three variations — different crops, colors or edits — in one
          post. We generate responsive assets for each, strip EXIF metadata and
          submit everything as a single wallpaper for review.
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
              Vercel sets the{" "}
              <code className="rounded bg-raised px-1 py-0.5 text-[10px]">BLOB_READ_WRITE_TOKEN</code>{" "}
              automatically. Then redeploy and uploads will work immediately.
            </p>
          </div>
        </div>
      )}

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
              onClick={() => fileInputRef.current?.click()}
              error={error}
            />
          )}

          {step === "metadata" && variations.length > 0 && (
            <MetadataStep
              variations={variations}
              onAdd={() => fileInputRef.current?.click()}
              onRemove={removeVariation}
              onMove={moveVariation}
              onLabel={setVariationLabel}
              error={error}
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
                if (variations.length) setStep("metadata");
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

function SelectStep({
  onDrop,
  onClick,
  error,
}: {
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
  error: string;
}) {
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
          aria-label={`Drop 1 to ${MAX_VARIATIONS} images or click to browse`}
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
              Drop 1–{MAX_VARIATIONS} images here
            </p>
            <p className="mt-1 text-sm text-secondary-text">
              or click to browse · one post, up to {MAX_VARIATIONS} variations
            </p>
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
            <span className="text-secondary-text/80">
              · up to {MAX_UPLOAD_BYTES / 1024 / 1024} MB each · min {MIN_DIMENSION}×{MIN_DIMENSION}
            </span>
          </div>
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertIcon size={14} />
              {error}
            </p>
          )}
        </div>
      </div>

      <aside className="lg:col-span-2">
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <SparklesIcon size={16} className="text-primary" />
            What happens next
          </div>
          <ol className="mt-4 flex flex-col gap-4 text-sm text-secondary-text">
            <PipelineStep index={1} title="Validate" desc="Type, size and dimensions of every image." />
            <PipelineStep index={2} title="Process" desc="Sharp generates responsive assets per variation." />
            <PipelineStep index={3} title="Extract" desc="Orientation and dominant color from the first image." />
            <PipelineStep index={4} title="Review" desc="One post enters the moderation queue." />
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
  variations: VariationItem[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onLabel: (id: string, label: string) => void;
  error: string;
  title: string;
  setTitle: (value: string) => void;
  categoryId: string;
  setCategoryId: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  tagsInput: string;
  setTagsInput: (value: string) => void;
  categories: CategoryItem[];
  categoriesLoading: boolean;
  canSubmit: boolean;
  onCancel: () => void;
  onSubmit: () => void;
};

function MetadataStep({
  variations,
  onAdd,
  onRemove,
  onMove,
  onLabel,
  error,
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
}: MetadataStepProps) {
  return (
    <section className="grid gap-6 lg:grid-cols-5">
      {/* Left: variation previews */}
      <div className="lg:col-span-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium text-foreground">
              Variations <span className="text-secondary-text">({variations.length}/{MAX_VARIATIONS})</span>
            </div>
            <span className="text-[11px] text-secondary-text">drag-free ordering</span>
          </div>

          <div className="flex flex-col gap-3">
            {variations.map((variation, index) => (
              <div
                key={variation.id}
                className="flex gap-3 rounded-xl border border-border bg-raised/50 p-2"
              >
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-surface">
                  <img
                    src={variation.previewUrl}
                    alt={variation.file.name}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <span className="absolute left-1 top-1 rounded bg-background/85 px-1.5 py-0.5 text-[9px] font-medium text-foreground">
                    {index + 1}
                  </span>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate text-xs font-medium text-foreground" title={variation.file.name}>
                    {variation.label || defaultVariationLabel(index)}
                  </p>
                  <p className="truncate text-[10px] text-secondary-text">
                    {variation.file.name} · {(variation.file.size / 1024).toFixed(0)} KB
                  </p>
                  <Input
                    value={variation.label}
                    onChange={(e) => onLabel(variation.id, e.target.value)}
                    placeholder={defaultVariationLabel(index)}
                    maxLength={80}
                    className="h-7 border-border bg-surface text-[11px]"
                    aria-label={`Label for variation ${index + 1}`}
                  />
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => onMove(variation.id, -1)}
                      disabled={index === 0}
                      className="rounded border border-border p-1 text-secondary-text transition-colors hover:text-foreground disabled:opacity-30"
                      aria-label={`Move variation ${index + 1} up`}
                    >
                      <ArrowDownIcon size={13} className="rotate-180" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(variation.id, 1)}
                      disabled={index === variations.length - 1}
                      className="rounded border border-border p-1 text-secondary-text transition-colors hover:text-foreground disabled:opacity-30"
                      aria-label={`Move variation ${index + 1} down`}
                    >
                      <ArrowDownIcon size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(variation.id)}
                      className="ml-auto rounded border border-border p-1 text-secondary-text transition-colors hover:text-destructive"
                      aria-label={`Remove variation ${index + 1}`}
                    >
                      <CloseIcon size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {variations.length < MAX_VARIATIONS && (
            <Button
              type="button"
              variant="outline"
              onClick={onAdd}
              className="mt-3 w-full border-border bg-surface text-secondary-text hover:text-foreground"
            >
              <PlusIcon size={15} className="mr-1.5" />
              Add another variation
            </Button>
          )}
          {error && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-destructive">
              <AlertIcon size={14} className="mt-0.5" />
              {error}
            </p>
          )}
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
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="upload-description" className="text-xs font-medium uppercase tracking-wide text-secondary-text">
              Description <span className="text-secondary-text/60">(optional)</span>
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
              Tags <span className="text-secondary-text/60">(optional, comma-separated)</span>
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
        Generating responsive assets for every variation, stripping EXIF and
        extracting metadata. This usually takes a few seconds.
      </p>
    </section>
  );
}

function ResultStep({ result, onReset }: { result: UploadResult; onReset: () => void }) {
  const gridAsset =
    result.assets.find((a) => a.variant === "grid") ?? result.assets[0];
  const variationCount = result.variationCount ?? result.variations?.length ?? 1;

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
        <p className="text-xs text-secondary-text">
          1 post · {variationCount} variation{variationCount > 1 ? "s" : ""}
        </p>
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

      {(result.variations?.length ?? 0) > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {result.variations?.map((variation) =>
            variation.previewAsset ? (
              <div key={variation.index} className="shrink-0">
                <img
                  src={variation.previewAsset.objectKey}
                  alt={variation.label}
                  className="h-20 w-28 rounded-lg border border-border object-cover"
                />
                <p className="mt-1 max-w-28 truncate text-[10px] text-secondary-text">
                  {variation.label}
                </p>
              </div>
            ) : null,
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <InfoCard label="Status" value={<span className="capitalize">{result.status}</span>} />
        <InfoCard label="Variants" value={`${result.assets.length} generated`} />
        <InfoCard label="Orientation" value={<span className="capitalize">{result.orientation}</span>} />
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
