"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Wand2,
  Sparkles,
  Loader2,
  Download,
  RefreshCw,
  Trash2,
  ImageIcon,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { WalloraMonogram } from "@/components/brand/wallora-logo";
import { useAiStudio } from "@/stores/ai-studio";
import { STYLE_PRESETS, ASPECT_RATIOS } from "@/lib/ai/presets";
import { cn } from "@/lib/utils";

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

export function AiStudioPanel() {
  const { open, setOpen } = useAiStudio();
  const queryClient = useQueryClient();

  const [prompt, setPrompt] = React.useState("");
  const [stylePreset, setStylePreset] = React.useState("none");
  const [aspectRatio, setAspectRatio] = React.useState("square");
  const [enhance, setEnhance] = React.useState(true);

  // Fetch generation history
  const { data: historyData } = useQuery<{ data: { items: Generation[]; pagination: { total: number } } }>({
    queryKey: ["generations"],
    queryFn: async () => {
      const res = await fetch("/api/v1/ai/generations?limit=12");
      if (!res.ok) return { data: { items: [], pagination: { total: 0 } } };
      return res.json();
    },
    enabled: open,
  });
  const generations = historyData?.data.items ?? [];

  // Generate mutation
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

  // Retry mutation
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

  // Delete mutation
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

  const handleDownload = async (gen: Generation) => {
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex bg-background/95 backdrop-blur-sm"
        >
          {/* Sidebar — Controls */}
          <aside className="hidden w-80 shrink-0 flex-col border-r border-border bg-surface/60 lg:flex">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <WalloraMonogram className="h-7 w-7" />
                <span className="font-display text-sm font-semibold">AI Studio</span>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpen(false)} aria-label="Close studio">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Prompt editor */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary-text">
                  Prompt
                </label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  placeholder="Describe what you want to create… e.g. a futuristic luxury bedroom with golden lighting"
                  className="resize-none border-border bg-surface text-sm"
                />
                <p className="mt-1 text-[11px] text-secondary-text">{prompt.length}/2000</p>
              </div>

              {/* Enhance toggle */}
              <label className="mb-4 flex cursor-pointer items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setEnhance((e) => !e)}
                  className={cn(
                    "relative h-5 w-9 rounded-full transition-colors",
                    enhance ? "bg-primary" : "bg-border",
                  )}
                  aria-label="Toggle prompt enhancement"
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                      enhance ? "translate-x-4" : "translate-x-0.5",
                    )}
                  />
                </button>
                <span className="flex items-center gap-1 text-xs text-foreground">
                  <Wand2 className="h-3 w-3 text-primary" />
                  Auto-enhance prompt
                </span>
              </label>

              {/* Style presets */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary-text">
                  Style preset
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {STYLE_PRESETS.map((p) => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setStylePreset(p.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-2 py-2 text-xs transition-colors",
                          stylePreset === p.id
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border bg-raised/60 text-secondary-text hover:text-foreground",
                        )}
                      >
                        <Icon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Aspect ratio */}
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

              {/* Cost + Generate */}
              <div className="sticky bottom-0 -mx-4 -mb-4 border-t border-border bg-surface/80 p-4 backdrop-blur">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-secondary-text">Cost</span>
                  <span className="font-medium text-foreground">5 credits</span>
                </div>
                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || generateMutation.isPending}
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate
                    </>
                  )}
                </Button>
                <p className="mt-1.5 text-center text-[11px] text-secondary-text">
                  {aspectInfo.size} · credits reserved, refunded on failure
                </p>
              </div>
            </div>
          </aside>

          {/* Main — Output gallery */}
          <div className="flex flex-1 flex-col">
            {/* Mobile header */}
            <header className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
              <div className="flex items-center gap-2">
                <WalloraMonogram className="h-7 w-7" />
                <span className="font-display text-sm font-semibold">AI Studio</span>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOpen(false)} aria-label="Close studio">
                <X className="h-4 w-4" />
              </Button>
            </header>

            {/* Mobile controls */}
            <div className="border-b border-border p-3 lg:hidden">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
                placeholder="Describe what you want to create…"
                className="mb-2 resize-none border-border bg-surface text-sm"
              />
              <div className="flex gap-2">
                <select
                  value={stylePreset}
                  onChange={(e) => setStylePreset(e.target.value)}
                  className="flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs"
                >
                  {STYLE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-xs"
                >
                  {ASPECT_RATIOS.map((a) => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </select>
              </div>
              <Button
                className="mt-2 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleGenerate}
                disabled={!prompt.trim() || generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" />Generate</>
                )}
              </Button>
            </div>

            {/* Gallery */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mx-auto max-w-4xl">
                {generations.length === 0 && !generateMutation.isPending ? (
                  <EmptyState />
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {generateMutation.isPending && (
                      <div className="flex aspect-square items-center justify-center rounded-xl border border-border bg-surface">
                        <div className="flex flex-col items-center gap-2 text-secondary-text">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                        isRetrying={retryMutation.isPending}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function GenerationCard({
  gen,
  onDownload,
  onRetry,
  onDelete,
  isRetrying,
}: {
  gen: Generation;
  onDownload: () => void;
  onRetry: () => void;
  onDelete: () => void;
  isRetrying: boolean;
}) {
  const aspectClass =
    gen.aspectRatio === "portrait" ? "aspect-[3/4]" :
    gen.aspectRatio === "landscape" ? "aspect-[16/9]" :
    "aspect-square";

  const preset = STYLE_PRESETS.find((p) => p.id === gen.stylePreset);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative overflow-hidden rounded-xl border border-border bg-surface"
    >
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
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-xs text-destructive">Failed</p>
            <p className="text-[10px] text-secondary-text">{gen.errorMessage?.slice(0, 60)}</p>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-surface">
            {isRetrying ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : (
              <ImageIcon className="h-8 w-8 text-secondary-text" />
            )}
          </div>
        )}

        {/* Overlay actions */}
        {gen.status === "completed" && (
          <div className="absolute inset-0 flex items-end justify-between gap-1 bg-gradient-to-t from-background/90 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onDownload}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/80 text-foreground backdrop-blur"
                aria-label="Download"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onRetry}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/80 text-foreground backdrop-blur"
                aria-label="Generate variation"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={onDelete}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/80 text-destructive backdrop-blur"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute right-1.5 top-1.5">
          {gen.status === "completed" && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20 text-success backdrop-blur">
              <CheckCircle2 className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>

      {/* Caption */}
      <div className="p-2.5">
        <p className="truncate text-xs font-medium text-foreground">{gen.prompt}</p>
        <div className="mt-1 flex items-center gap-1.5">
          {preset && preset.id !== "none" && (
            <Badge variant="outline" className="border-border bg-surface text-[9px] text-secondary-text">
              {preset.name}
            </Badge>
          )}
          <span className="text-[10px] text-secondary-text">{gen.creditsUsed} credits</span>
        </div>
        {gen.status === "failed" && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-md border border-border bg-raised py-1 text-[10px] text-foreground hover:bg-surface"
          >
            <RefreshCw className="h-2.5 w-2.5" /> Retry
          </button>
        )}
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-6 py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="h-8 w-8" />
      </span>
      <div>
        <h3 className="font-display text-xl font-semibold text-foreground">AI Studio</h3>
        <p className="mt-2 max-w-md text-sm text-secondary-text">
          Describe what you want to create, pick a style and aspect ratio, then click Generate.
          Your AI-generated images appear here with download and variation options.
        </p>
      </div>
      <div className="grid gap-2 text-left">
        {[
          "A futuristic luxury bedroom with black walls and golden lighting",
          "Neon cyberpunk city skyline at night, rain-soaked streets",
          "Minimalist abstract wallpaper with gold and charcoal textures",
        ].map((example) => (
          <div
            key={example}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-secondary-text"
          >
            {example}
          </div>
        ))}
      </div>
      <Badge variant="outline" className="border-border bg-surface text-[10px] text-secondary-text">
        Phase 6 · AI Studio & Generation
      </Badge>
    </div>
  );
}
