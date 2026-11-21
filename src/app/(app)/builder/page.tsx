"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Check,
  Code2,
  ExternalLink,
  Eye,
  Globe,
  Loader2,
  Plus,
  Send,
  ShoppingBag,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Site = {
  id: string;
  slug: string;
  title: string;
  prompt: string;
  html: string;
  published: boolean;
  externalPublished: boolean;
  forSale: boolean;
  priceCents: number;
  model: string;
  createdAt: string;
  updatedAt: string;
};

const STAGES = [
  "Understanding the brief",
  "Planning pages and structure",
  "Writing the interface",
  "Styling and responsive layout",
  "Adding interactions",
  "Polishing the details",
];

const STARTERS = [
  "A dark portfolio site for a motion designer with a project grid and contact form",
  "A SaaS landing page for an AI note-taking app with pricing tiers and FAQ",
  "A café menu and ordering app with a cart that persists in local storage",
  "A personal dashboard with task list, stats cards and a weekly chart",
];

export default function BuilderPage() {
  const qc = useQueryClient();
  const { status } = useSession();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [prompt, setPrompt] = React.useState("");
  const [tab, setTab] = React.useState<"preview" | "code">("preview");
  const [stage, setStage] = React.useState(-1);
  const [showStages, setShowStages] = React.useState(false);
  const [price, setPrice] = React.useState("49");

  const sitesQuery = useQuery<{ data: { sites: Site[] } }>({
    queryKey: ["sites"],
    queryFn: () => fetch("/api/v1/sites").then((r) => r.json()),
    enabled: status === "authenticated",
  });
  const sites = sitesQuery.data?.data.sites ?? [];
  const active = sites.find((s) => s.id === activeId) ?? null;

  React.useEffect(() => {
    if (!activeId && sites.length > 0) setActiveId(sites[0].id);
  }, [sites, activeId]);

  React.useEffect(() => {
    if (!showStages) {
      setStage(-1);
      return;
    }
    setStage(0);
    const timer = window.setInterval(() => {
      setStage((s) => (s + 1) % STAGES.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [showStages]);

  const build = useMutation({
    mutationFn: (vars: { prompt: string; siteId?: string }) =>
      fetch("/api/v1/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      }).then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? "Build failed");
        return json.data as { site: Site };
      }),
    onMutate: () => {
      setShowStages(true);
      setTab("preview");
    },
    onSuccess: (data) => {
      setActiveId(data.site.id);
      setPrompt("");
      qc.invalidateQueries({ queryKey: ["sites"] });
      toast.success("Site built", { description: "Preview is ready on the right." });
    },
    onError: (err: Error) => toast.error("Build failed", { description: err.message }),
    onSettled: () => setShowStages(false),
  });

  const saveCode = useMutation({
    mutationFn: (vars: { id: string; html: string }) =>
      fetch(`/api/v1/sites/${vars.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: vars.html }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sites"] });
      toast.success("Changes saved");
    },
  });

  const publish = useMutation({
    mutationFn: (vars: { id: string; body: Record<string, unknown> }) =>
      fetch(`/api/v1/sites/${vars.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars.body),
      }).then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? "Publish failed");
        return json.data as { internalUrl: string; externalUrl: string | null };
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["sites"] });
      toast.success(data.externalUrl ? "Live at your direct link" : "Published inside WALLORA");
    },
    onError: (err: Error) => toast.error("Could not publish", { description: err.message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => fetch(`/api/v1/sites/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      setActiveId(null);
      qc.invalidateQueries({ queryKey: ["sites"] });
      toast.success("Site deleted");
    },
  });

  const submit = () => {
    const value = prompt.trim();
    if (!value || build.isPending) return;
    build.mutate({ prompt: value, siteId: active?.id });
  };

  if (status === "unauthenticated") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <Sparkles className="size-10 text-primary" />
        <h1 className="font-display text-xl font-semibold">Sign in to build</h1>
        <p className="max-w-sm text-sm text-secondary-text">
          WALLORA Builder saves every site to your account so you can preview, publish and sell it later.
        </p>
        <Button asChild><Link href="/login">Sign in</Link></Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sites sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface/40 lg:flex">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary-text">My sites</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => { setActiveId(null); setPrompt(""); }}
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {sites.length === 0 && (
            <p className="px-3 py-8 text-center text-xs text-secondary-text">
              No sites yet. Describe one to get started.
            </p>
          )}
          {sites.map((site) => (
            <div
              key={site.id}
              onClick={() => setActiveId(site.id)}
              className={cn(
                "group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-xs transition-colors",
                activeId === site.id
                  ? "bg-raised text-foreground"
                  : "text-secondary-text hover:bg-surface hover:text-foreground",
              )}
            >
              <Globe className="size-3.5 shrink-0" />
              <span className="flex-1 truncate">{site.title}</span>
              {site.published && <span className="size-1.5 rounded-full bg-emerald-500" />}
              <button
                type="button"
                aria-label="Delete site"
                onClick={(e) => { e.stopPropagation(); remove.mutate(site.id); }}
                className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-3">
          <p className="text-[11px] leading-relaxed text-secondary-text">
            Sites are saved to your WALLORA account. Publish to get a live link.
          </p>
        </div>
      </aside>

      {/* Builder workspace */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Code2 className="size-4 text-primary" />
            <span className="font-display text-sm font-semibold">WALLORA Builder</span>
            {active && <Badge variant="secondary" className="text-[10px]">{active.model}</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
              <Link href="/sites">Explore sites</Link>
            </Button>
            <select
              value={activeId ?? ""}
              onChange={(e) => setActiveId(e.target.value || null)}
              className="h-8 max-w-[180px] rounded-md border border-border bg-surface px-2 text-xs lg:hidden"
            >
              <option value="">New site</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            {active && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => publish.mutate({ id: active.id, body: { published: !active.published } })}
                disabled={publish.isPending}
              >
                <Globe className="size-3.5" />
                {active.published ? "Unpublish" : "Publish"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[340px_1fr]">
          {/* Prompt / progress */}
          <div className="flex min-h-0 flex-col border-r border-border">
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div>
                <h2 className="font-display text-lg font-semibold">
                  {active ? active.title : "What should we build?"}
                </h2>
                <p className="mt-1 text-xs text-secondary-text">
                  {active
                    ? "Refine it below — describe changes and the builder will rewrite the site."
                    : "Describe a site, app, landing page or dashboard. The builder writes the full interface."}
                </p>
              </div>

              {!active && (
                <div className="space-y-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPrompt(s)}
                      className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-xs text-secondary-text transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {showStages && (
                <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <p className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <Loader2 className="size-3.5 animate-spin" /> Building your site
                  </p>
                  {STAGES.map((label, i) => (
                    <div key={label} className="flex items-center gap-2 text-[11px]">
                      <span
                        className={cn(
                          "flex size-4 items-center justify-center rounded-full border",
                          i < stage
                            ? "border-primary bg-primary text-primary-foreground"
                            : i === stage
                              ? "border-primary text-primary"
                              : "border-border text-secondary-text",
                        )}
                      >
                        {i < stage ? <Check className="size-2.5" /> : <span className="size-1 rounded-full bg-current" />}
                      </span>
                      <span className={i <= stage ? "text-foreground" : "text-secondary-text"}>{label}</span>
                    </div>
                  ))}
                </div>
              )}

              {active && (
                <div className="space-y-3 rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs font-semibold">Publish &amp; share</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={active.published ? "default" : "secondary"}>
                      {active.published ? "Published" : "Private"}
                    </Badge>
                    {active.published && (
                      <Link
                        href={`/sites/${active.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                      >
                        /sites/{active.slug} <ExternalLink className="size-3" />
                      </Link>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    disabled={!active.published || publish.isPending}
                    onClick={() => publish.mutate({ id: active.id, body: { external: !active.externalPublished } })}
                  >
                    <ExternalLink className="size-3.5" />
                    {active.externalPublished ? "Disable direct link" : "Get direct link (Pro)"}
                  </Button>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="text-[11px] text-secondary-text">Price (USD)</label>
                      <Input
                        className="mt-1 h-8 text-xs"
                        type="number"
                        min="0"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() =>
                        publish.mutate({
                          id: active.id,
                          body: {
                            forSale: !active.forSale,
                            priceCents: Math.round(Number(price || 0) * 100),
                          },
                        })
                      }
                    >
                      <ShoppingBag className="size-3.5" />
                      {active.forSale ? "Unlist" : "List for sale"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border p-3">
              <div className="relative rounded-xl border border-border bg-raised p-2 focus-within:border-primary/40">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
                  }}
                  rows={3}
                  placeholder={active ? "Describe the changes you want…" : "e.g. A portfolio site for a photographer…"}
                  className="resize-none border-0 bg-transparent pr-10 text-xs focus-visible:ring-0"
                  disabled={build.isPending}
                />
                <Button
                  size="icon"
                  className="absolute bottom-2 right-2 size-8"
                  onClick={submit}
                  disabled={!prompt.trim() || build.isPending}
                  aria-label="Build"
                >
                  {build.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </div>
              <p className="mt-1.5 px-1 text-[10px] text-secondary-text">
                Enter to build · Shift+Enter for newline
              </p>
            </div>
          </div>

          {/* Preview / code */}
          <div className="flex min-h-0 min-w-0 flex-col bg-black/20">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Button
                size="sm"
                variant={tab === "preview" ? "default" : "ghost"}
                className="h-7 text-xs"
                onClick={() => setTab("preview")}
              >
                <Eye className="size-3.5" /> Preview
              </Button>
              <Button
                size="sm"
                variant={tab === "code" ? "default" : "ghost"}
                className="h-7 text-xs"
                onClick={() => setTab("code")}
              >
                <Code2 className="size-3.5" /> Code
              </Button>
              {active && (
                <span className="ml-auto truncate text-[10px] text-secondary-text">
                  Last edited {new Date(active.updatedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
            <div className="min-h-0 flex-1 p-3">
              {!active ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <Sparkles className="size-10 text-primary/40" />
                  <p className="max-w-xs text-sm text-secondary-text">
                    Your site preview will appear here. Give the builder a brief on the left.
                  </p>
                </div>
              ) : tab === "preview" ? (
                <iframe
                  key={active.id + active.updatedAt}
                  title={active.title}
                  srcDoc={active.html}
                  sandbox="allow-scripts allow-forms allow-modals allow-popups"
                  className="h-full w-full rounded-lg border border-border bg-white"
                />
              ) : (
                <div className="flex h-full flex-col gap-2">
                  <Textarea
                    value={active.html}
                    onChange={(e) =>
                      qc.setQueryData<{ data: { sites: Site[] } }>(["sites"], (old) => ({
                        data: {
                          sites: (old?.data.sites ?? []).map((s) =>
                            s.id === active.id ? { ...s, html: e.target.value } : s,
                          ),
                        },
                      }))
                    }
                    className="min-h-0 flex-1 resize-none bg-black font-mono text-[11px] leading-relaxed"
                    spellCheck={false}
                  />
                  <Button
                    size="sm"
                    className="self-end"
                    onClick={() => saveCode.mutate({ id: active.id, html: active.html })}
                  >
                    Save changes
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
