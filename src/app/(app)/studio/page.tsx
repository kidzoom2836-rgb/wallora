"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WalloraMonogram } from "@/components/brand/wallora-logo";
import { useAuthDialog } from "@/stores/auth-dialog";
import { STYLE_PRESETS, ASPECT_RATIOS } from "@/lib/ai/presets";
import {
  SparklesIcon,
  LoaderIcon,
  DownloadIcon,
  RefreshIcon,
  TrashIcon,
  AlertIcon,
  CheckCircleIcon,
  ImageIcon,
  WandIcon,
  UploadIcon,
} from "@/components/icons/wallora-icons";
import { cn } from "@/lib/utils";

/**
 * WALLORA AI Studio — full-page image generation workspace.
 *
 * Authenticated users describe what they want, pick a style preset and aspect
 * ratio, optionally auto-enhance the prompt, then generate. Results land in a
 * scrollable gallery with download / retry / delete actions.
 *
 * Layout: fixed-height (viewport minus the 4rem sticky header) split into a
 * desktop sidebar (controls) + main gallery area. On mobile the controls
 * collapse above the gallery.
 */

type Generation = {
  id: string;
  prompt: string;
  stylePreset: string;
  aspectRatio: string;
  size: string;
  status: string;
  publicUrl: string | null;
  width: number;
  height: number;
  creditsUsed: number;
  errorMessage: string | null;
  createdAt: string;
};

type PresetsResponse = {
  data: {
    stylePresets: { id: string; name: string; description: string; icon: string }[];
    aspectRatios: { id: string; label: string; size: string; ratio: string }[];
    generationCost: Record<string, number>;
  };
};

const GENERATION_COST_FALLBACK = 5;

const EXAMPLE_PROMPTS = [
  "A futuristic luxury bedroom with black walls and golden ambient lighting",
  "Neon cyberpunk city skyline at night, rain-soaked streets reflecting holograms",
  "Minimalist abstract wallpaper with gold and charcoal textures, soft gradient",
];

export default function StudioPage() {
  const queryClient = useQueryClient();
  const { data: session, status } = useSession();
  const openSignIn = useAuthDialog((s) => s.openSignIn);

  const [prompt, setPrompt] = React.useState("");
  const [stylePreset, setStylePreset] = React.useState("none");
  const [aspectRatio, setAspectRatio] = React.useState("square");
  const [enhance, setEnhance] = React.useState(true);
  /** Generation ids already submitted for moderation in this session. */
  const [publishedIds, setPublishedIds] = React.useState<string[]>([]);
  const [publishTarget, setPublishTarget] = React.useState<string | null>(null);
  const [publishResult, setPublishResult] = React.useState<{
    slug: string;
    moderationNote: string;
  } | null>(null);

  const authenticated = status === "authenticated" && !!session?.user;

  // --- Presets (for the dynamic credit cost) -------------------------------
  const { data: presetsData } = useQuery<PresetsResponse>({
    queryKey: ["ai-presets"],
    queryFn: async () => {
      const res = await fetch("/api/v1/ai/presets");
      if (!res.ok) throw new Error("Failed to load presets");
      return res.json();
    },
  });
  const generationCost =
    presetsData?.data.generationCost?.[aspectRatio] ?? GENERATION_COST_FALLBACK;

  // --- Generation history --------------------------------------------------
  const { data: historyData } = useQuery<{
    data: { items: Generation[]; pagination: { total: number } };
  }>({
    queryKey: ["generations"],
    queryFn: async () => {
      const res = await fetch("/api/v1/ai/generations?limit=12");
      if (!res.ok) return { data: { items: [], pagination: { total: 0 } } };
      return res.json();
    },
    enabled: authenticated,
  });
  const generations = historyData?.data.items ?? [];

  // --- Generate ------------------------------------------------------------
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/ai/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, stylePreset, aspectRatio, enhance }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Generation failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generations"] });
      toast.success("Image generated", { description: "Your creation is ready." });
    },
    onError: (err: Error) => {
      toast.error("Generation failed", { description: err.message });
      queryClient.invalidateQueries({ queryKey: ["generations"] });
    },
  });

  // --- Retry ----------------------------------------------------------------
  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/ai/generations/${id}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Retry failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generations"] });
      toast.success("Retry completed");
    },
    onError: (err: Error) => {
      toast.error("Retry failed", { description: err.message });
      queryClient.invalidateQueries({ queryKey: ["generations"] });
    },
  });

  // --- Publish to WALLORA ----------------------------------------------------
  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/ai/generations/${id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Publish failed");
      return data.data as { id: string; slug: string; status: string; moderationNote: string };
    },
    onSuccess: (data, id) => {
      setPublishedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setPublishTarget(null);
      setPublishResult({
        slug: data.slug,
        moderationNote:
          data.moderationNote ?? "Your wallpaper is private until an admin approves it.",
      });
    },
    onError: (err: Error) => {
      toast.error("Publish failed", { description: err.message });
      setPublishTarget(null);
    },
  });

  // --- Delete ---------------------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/ai/generations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generations"] });
      toast.success("Generation deleted");
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim() || generateMutation.isPending) return;
    generateMutation.mutate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleDownload = (gen: Generation) => {
    if (!gen.publicUrl) return;
    const a = document.createElement("a");
    a.href = gen.publicUrl;
    a.download = `wallora-${gen.id.slice(-8)}.jpg`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Download started");
  };

  const aspectInfo = ASPECT_RATIOS.find((a) => a.id === aspectRatio) ?? ASPECT_RATIOS[0];
  const isGenerating = generateMutation.isPending;

  // --- Session loading ------------------------------------------------------
  if (status === "loading") {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-background">
        <LoaderIcon size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  // --- Not authenticated ----------------------------------------------------
  if (!authenticated) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <SparklesIcon size={32} />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">AI Studio</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-secondary-text">
              Sign in to use AI Studio and start generating stunning images from your prompts.
            </p>
          </div>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openSignIn}
          >
            Sign in to use AI Studio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* ============== Sidebar (desktop) ============== */}
      <aside className="hidden w-80 shrink-0 flex-col border-r border-border bg-surface/40 lg:flex">
        {/* Sidebar header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
          <WalloraMonogram className="h-7 w-7" />
          <span className="font-display text-sm font-semibold text-foreground">AI Studio</span>
        </div>

        {/* Sidebar scrollable content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Prompt */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary-text">
              Prompt
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
              placeholder="Describe what you want to create… e.g. a futuristic luxury bedroom with golden lighting"
              className="resize-none border-border bg-surface text-sm placeholder:text-secondary-text/70"
            />
            <p className="mt-1 text-[11px] text-secondary-text">{prompt.length}/2000</p>
          </div>

          {/* Auto-enhance toggle */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setEnhance((e) => !e)}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-raised/60 px-3 py-2.5 text-left transition-colors hover:border-primary/30"
              aria-pressed={enhance}
            >
              <span className="flex items-center gap-2 text-xs text-foreground">
                <WandIcon size={14} className="text-primary" />
                Auto-enhance prompt
              </span>
              <span
                className={cn(
                  "relative h-5 w-9 rounded-full transition-colors",
                  enhance ? "bg-primary" : "bg-border",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                    enhance ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </span>
            </button>
            <p className="mt-1 px-1 text-[11px] leading-relaxed text-secondary-text">
              AI rewrites your prompt with richer detail before generating.
            </p>
          </div>

          {/* Style presets — 12 buttons, name only */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary-text">
              Style preset
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {STYLE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setStylePreset(p.id)}
                  title={p.description}
                  className={cn(
                    "truncate rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                    stylePreset === p.id
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-raised/60 text-secondary-text hover:text-foreground",
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Aspect ratio — 3 selectors */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary-text">
              Aspect ratio
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {ASPECT_RATIOS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAspectRatio(a.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs transition-colors",
                    aspectRatio === a.id
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-raised/60 text-secondary-text hover:text-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "border",
                      a.id === "square" && "h-5 w-5",
                      a.id === "portrait" && "h-5 w-3",
                      a.id === "landscape" && "h-3 w-5",
                      aspectRatio === a.id ? "border-primary" : "border-secondary-text",
                    )}
                  />
                  <span>{a.label}</span>
                  <span className="text-[10px] opacity-60">{a.ratio}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar footer — cost + generate */}
        <div className="border-t border-border bg-surface/80 p-4 backdrop-blur">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-secondary-text">Cost</span>
            <span className="font-medium text-foreground">{generationCost} credits</span>
          </div>
          <Button
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
          >
            {isGenerating ? (
              <>
                <LoaderIcon size={16} className="mr-2 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <SparklesIcon size={16} className="mr-2" />
                Generate
              </>
            )}
          </Button>
          <p className="mt-1.5 text-center text-[11px] text-secondary-text">
            {aspectInfo.size} · credits refunded on failure
          </p>
        </div>
      </aside>

      {/* ============== Main area ============== */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex items-center gap-2 border-b border-border px-4 py-3 lg:hidden">
          <WalloraMonogram className="h-7 w-7" />
          <span className="font-display text-sm font-semibold text-foreground">AI Studio</span>
        </header>

        {/* Mobile controls — prompt + style + aspect + generate above gallery */}
        <div className="border-b border-border p-3 lg:hidden">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Describe what you want to create…"
            className="mb-2 resize-none border-border bg-surface text-sm placeholder:text-secondary-text/70"
          />
          <div className="flex gap-2">
            <Select value={stylePreset} onValueChange={setStylePreset}>
              <SelectTrigger className="h-9 flex-1 border-border bg-surface text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover">
                {STYLE_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger className="h-9 w-28 border-border bg-surface text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover">
                {ASPECT_RATIOS.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setEnhance((e) => !e)}
              className="flex items-center gap-2 text-xs text-secondary-text"
              aria-pressed={enhance}
            >
              <span
                className={cn(
                  "relative h-4 w-8 rounded-full transition-colors",
                  enhance ? "bg-primary" : "bg-border",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform",
                    enhance ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </span>
              <WandIcon size={12} className="text-primary" />
              Auto-enhance
            </button>
            <span className="text-[11px] text-secondary-text">{generationCost} credits</span>
          </div>
          <Button
            className="mt-2 w-full bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
          >
            {isGenerating ? (
              <>
                <LoaderIcon size={16} className="mr-2 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <SparklesIcon size={16} className="mr-2" />
                Generate
              </>
            )}
          </Button>
        </div>

        {/* Gallery — scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-5xl">
            {generations.length === 0 && !isGenerating ? (
              <EmptyState onExampleClick={setPrompt} />
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Your generations</h2>
                  <span className="text-xs text-secondary-text">{generations.length} images</span>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {isGenerating && (
                    <div className="flex aspect-square items-center justify-center rounded-xl border border-border bg-surface">
                      <div className="flex flex-col items-center gap-2 text-secondary-text">
                        <LoaderIcon size={28} className="animate-spin text-primary" />
                        <span className="text-xs">Generating…</span>
                      </div>
                    </div>
                  )}
                  {generations.map((gen) => (
                    <GenerationCard
                      key={gen.id}
                      gen={gen}
                      onDownload={() => handleDownload(gen)}
                      onRetry={() => retryMutation.mutate(gen.id)}
                      onDelete={() => deleteMutation.mutate(gen.id)}
                      onPublish={() => {
                        setPublishResult(null);
                        setPublishTarget(gen.id);
                      }}
                      isRetrying={retryMutation.isPending}
                      isPublishing={publishMutation.isPending && publishMutation.variables === gen.id}
                      published={publishedIds.includes(gen.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Publish confirmation → completion popup */}
      <Dialog
        open={!!publishTarget || !!publishResult}
        onOpenChange={(open) => {
          if (!open) {
            setPublishTarget(null);
            setPublishResult(null);
          }
        }}
      >
        <DialogContent className="border-border bg-surface text-foreground sm:max-w-md">
          {publishResult ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-display">
                  <CheckCircleIcon size={20} className="text-success" />
                  Submitted to WALLORA
                </DialogTitle>
                <DialogDescription className="text-secondary-text">
                  Your generation is now a private, pending wallpaper. You can keep creating while
                  an admin reviews it.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-wider text-secondary-text">Wallpaper slug</p>
                <p className="mt-1 break-all text-sm text-foreground">{publishResult.slug}</p>
                <p className="mt-3 text-xs leading-relaxed text-secondary-text">
                  {publishResult.moderationNote}
                </p>
              </div>
              <DialogFooter>
                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setPublishResult(null)}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Publish this wallpaper?</DialogTitle>
                <DialogDescription className="text-secondary-text">
                  This creates a private wallpaper post from your AI generation and sends it for
                  admin review. It becomes visible to the community only after approval.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs text-primary">
                <UploadIcon size={16} className="mt-0.5 shrink-0" />
                <span>
                  You keep the original in your studio. Publishing never removes your generation.
                </span>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  className="border-border bg-background text-foreground hover:bg-raised"
                  onClick={() => setPublishTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={publishMutation.isPending}
                  onClick={() => publishTarget && publishMutation.mutate(publishTarget)}
                >
                  {publishMutation.isPending ? (
                    <LoaderIcon size={16} className="mr-2 animate-spin" />
                  ) : (
                    <UploadIcon size={16} className="mr-2" />
                  )}
                  Submit for review
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generation card
// ---------------------------------------------------------------------------

function GenerationCard({
  gen,
  onDownload,
  onRetry,
  onDelete,
  onPublish,
  isRetrying,
  isPublishing,
  published,
}: {
  gen: Generation;
  onDownload: () => void;
  onRetry: () => void;
  onDelete: () => void;
  onPublish: () => void;
  isRetrying: boolean;
  isPublishing: boolean;
  published: boolean;
}) {
  const aspectClass =
    gen.aspectRatio === "portrait"
      ? "aspect-[3/4]"
      : gen.aspectRatio === "landscape"
        ? "aspect-[16/9]"
        : "aspect-square";

  const preset = STYLE_PRESETS.find((p) => p.id === gen.stylePreset);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-primary/30">
      <div className={cn("relative overflow-hidden", aspectClass)}>
        {gen.status === "completed" && gen.publicUrl ? (
          <img
            src={gen.publicUrl}
            alt={gen.prompt}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : gen.status === "failed" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface p-4 text-center">
            <AlertIcon size={28} className="text-destructive" />
            <p className="text-xs font-medium text-destructive">Failed</p>
            <p className="line-clamp-2 text-[10px] text-secondary-text">
              {gen.errorMessage?.slice(0, 80)}
            </p>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-surface">
            {isRetrying ? (
              <LoaderIcon size={24} className="animate-spin text-primary" />
            ) : (
              <ImageIcon size={28} className="text-secondary-text" />
            )}
          </div>
        )}

        {/* Hover overlay actions (completed only) */}
        {gen.status === "completed" && (
          <div className="absolute inset-0 flex items-end justify-between gap-1 bg-gradient-to-t from-background/90 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onDownload}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background"
                aria-label="Download image"
              >
                <DownloadIcon size={14} />
              </button>
              <button
                type="button"
                onClick={onRetry}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background"
                aria-label="Generate variation"
              >
                <RefreshIcon size={14} />
              </button>
              <button
                type="button"
                onClick={onPublish}
                disabled={published || isPublishing}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/80 text-primary backdrop-blur transition-colors hover:bg-background disabled:opacity-50"
                aria-label="Publish to WALLORA"
                title={published ? "Submitted for review" : "Publish to WALLORA"}
              >
                {isPublishing ? (
                  <LoaderIcon size={14} className="animate-spin" />
                ) : (
                  <UploadIcon size={14} />
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={onDelete}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/80 text-destructive backdrop-blur transition-colors hover:bg-background"
              aria-label="Delete generation"
            >
              <TrashIcon size={14} />
            </button>
          </div>
        )}

        {/* Status badge */}
        {gen.status === "completed" && (
          <div className="absolute right-1.5 top-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20 text-success backdrop-blur">
              <CheckCircleIcon size={12} />
            </span>
          </div>
        )}
      </div>

      {/* Caption */}
      <div className="p-2.5">
        <p className="truncate text-xs font-medium text-foreground">{gen.prompt}</p>
        <div className="mt-1 flex items-center gap-1.5">
          {preset && preset.id !== "none" && (
            <Badge variant="outline" className="border-border bg-surface px-1.5 py-0 text-[9px] font-normal text-secondary-text">
              {preset.name}
            </Badge>
          )}
          <span className="text-[10px] text-secondary-text">{gen.creditsUsed} credits</span>
        </div>

        {/* Publish is a first-class action so it is reachable on touch devices. */}
        {gen.status === "completed" && (
          <button
            type="button"
            onClick={onPublish}
            disabled={published || isPublishing}
            className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-default disabled:opacity-70"
          >
            {isPublishing ? (
              <LoaderIcon size={12} className="animate-spin" />
            ) : published ? (
              <CheckCircleIcon size={12} />
            ) : (
              <UploadIcon size={12} />
            )}
            {published ? "Submitted for review" : "Publish to WALLORA"}
          </button>
        )}

        {gen.status === "failed" && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-md border border-border bg-raised py-1 text-[10px] text-foreground transition-colors hover:bg-surface"
          >
            <RefreshIcon size={12} /> Retry
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onExampleClick }: { onExampleClick: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center sm:py-20">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <SparklesIcon size={32} />
      </span>
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Start creating</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-secondary-text">
          Describe what you want to create, pick a style and aspect ratio, then click Generate.
          Your AI-generated images appear here with download and variation options.
        </p>
      </div>
      <div className="grid w-full max-w-md gap-2 text-left">
        {EXAMPLE_PROMPTS.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onExampleClick(example)}
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-xs text-secondary-text transition-colors hover:border-primary/30 hover:text-foreground"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
