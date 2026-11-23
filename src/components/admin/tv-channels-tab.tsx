"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Tv,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const DEFAULT_SOURCE = "https://raw.githubusercontent.com/nn2wdw5jvc-max/mu-iptv/main/EDEM_2.m3u";

type ChannelStatus = "active" | "hidden" | "disabled";

type Channel = {
  id: string;
  name: string;
  group: string;
  logo?: string;
  url: string;
  previewUrl?: string;
  isFeatured: boolean;
  status?: ChannelStatus;
  sortOrder?: number;
  createdAt?: string;
};

type ChannelPage = {
  items: Channel[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  source: string;
};

type SyncStatus = {
  defaultSource: string;
  sources: {
    id: string;
    name: string;
    url: string;
    enabled: boolean;
    lastSyncedAt: string | null;
    lastChannelCount: number;
    lastError: string | null;
  }[];
};

type ChannelForm = {
  name: string;
  groupName: string;
  streamUrl: string;
  logoUrl: string;
  isFeatured: boolean;
};

const EMPTY_FORM: ChannelForm = {
  name: "",
  groupName: "General",
  streamUrl: "",
  logoUrl: "",
  isFeatured: false,
};

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error?.message ?? `Request failed (${res.status})`);
  }
  return payload as T;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

/* -------------------------------------------------------------------------- */
/* TV channels tab                                                            */
/* -------------------------------------------------------------------------- */

export function TvChannelsTab() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ChannelStatus | "all">("active");
  const [page, setPage] = useState(1);
  const [sourceUrl, setSourceUrl] = useState(DEFAULT_SOURCE);
  const [form, setForm] = useState<ChannelForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [showForm, setShowForm] = useState(false);

  const channelsQuery = useQuery<{ data: ChannelPage }>({
    queryKey: ["ak-channels", search, status, page],
    queryFn: () =>
      jsonFetch(
        `/api/v1/channels?admin=1&limit=50&page=${page}&q=${encodeURIComponent(search)}` +
          (status === "all" ? "" : `&status=${status}`),
      ),
    placeholderData: keepPreviousData,
  });

  const syncQuery = useQuery<{ data: SyncStatus }>({
    queryKey: ["ak-channel-sync"],
    queryFn: () => jsonFetch("/api/v1/channels/sync"),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["ak-channels"] });
    void queryClient.invalidateQueries({ queryKey: ["ak-channel-sync"] });
  };

  const syncMutation = useMutation({
    mutationFn: (dryRun: boolean) =>
      jsonFetch<{ data: { count?: number; total?: number; created?: number; updated?: number } }>(
        "/api/v1/channels/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceUrl: sourceUrl || DEFAULT_SOURCE, dryRun }),
        },
      ),
    onSuccess: (result, dryRun) => {
      const data = result.data;
      if (dryRun) {
        toast.success(`${data.count ?? 0} channels found in that playlist.`);
        return;
      }
      toast.success(
        `Synced ${data.total ?? 0} channels (${data.created ?? 0} new, ${data.updated ?? 0} updated).`,
      );
      invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const saveMutation = useMutation({
    mutationFn: ({ values, id }: { values: ChannelForm; id?: string }) =>
      jsonFetch(id ? `/api/v1/channels/${encodeURIComponent(id)}` : "/api/v1/channels", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          groupName: values.groupName,
          streamUrl: values.streamUrl,
          logoUrl: values.logoUrl || null,
          isFeatured: values.isFeatured,
        }),
      }),
    onSuccess: (_result, variables) => {
      toast.success(variables.id ? "Channel updated." : "Channel added to the guide.");
      setForm(EMPTY_FORM);
      setEditing(null);
      setShowForm(false);
      invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const flagMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      jsonFetch(`/api/v1/channels/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    onSuccess: (_result, variables) => {
      toast.success(
        variables.patch.status === "hidden"
          ? "Channel hidden from the app."
          : variables.patch.status === "active"
            ? "Channel restored to the app."
            : "Channel updated.",
      );
      invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const channels = channelsQuery.data?.data.items ?? [];
  const pagination = channelsQuery.data?.data.pagination;
  const syncHistory = syncQuery.data?.data.sources ?? [];

  const startEdit = (channel: Channel) => {
    setEditing(channel);
    setShowForm(true);
    setForm({
      name: channel.name,
      groupName: channel.group,
      streamUrl: channel.url,
      logoUrl: channel.logo ?? "",
      isFeatured: channel.isFeatured,
    });
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(query.trim());
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-border bg-surface/60 p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Tv className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold">WALLORA TV guide</h2>
            <p className="mt-0.5 max-w-2xl text-xs text-secondary-text">
              Channels are stored in the platform database and served to the mobile app from this
              backend. Sync the public M3U guide or add channels by hand.
            </p>
          </div>
        </div>

        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-secondary-text">
          M3U playlist URL
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder={DEFAULT_SOURCE}
            className="font-mono text-xs"
          />
          <Button
            variant="outline"
            className="shrink-0"
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate(true)}
          >
            {syncMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Preview
          </Button>
          <Button
            className="shrink-0"
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate(false)}
          >
            {syncMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Sync to database
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-secondary-text">
          <span>Default source:</span>
          <button
            type="button"
            onClick={() => setSourceUrl(syncQuery.data?.data.defaultSource ?? DEFAULT_SOURCE)}
            className="max-w-full truncate rounded-md bg-muted px-2 py-1 font-mono text-[10px] text-foreground hover:underline"
          >
            {syncQuery.data?.data.defaultSource ?? DEFAULT_SOURCE}
          </button>
        </div>

        {syncHistory.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            {syncHistory.slice(0, 4).map((source) => (
              <div
                key={source.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 text-[11px] last:border-b-0"
              >
                <span className="font-medium">{source.name}</span>
                <span className="text-secondary-text">
                  {source.lastChannelCount} channels · synced {formatDate(source.lastSyncedAt)}
                </span>
                {source.lastError ? (
                  <Badge variant="destructive">Sync error</Badge>
                ) : (
                  <Badge variant="outline">{source.enabled ? "Enabled" : "Paused"}</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold">Channels</h2>
            <p className="mt-0.5 text-xs text-secondary-text">
              {pagination ? `${pagination.total} channels in this view` : "Loading guide…"}
            </p>
          </div>
          <Button
            variant={showForm ? "outline" : "default"}
            onClick={() => {
              setShowForm((current) => !current);
              setEditing(null);
              setForm(EMPTY_FORM);
            }}
          >
            {showForm ? <Check className="size-4" /> : <Plus className="size-4" />}
            {showForm ? "Close" : "Add channel"}
          </Button>
        </div>

        {showForm && (
          <form
            className="mb-5 grid gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!form.name.trim() || !form.streamUrl.trim()) {
                toast.error("Name and stream URL are required.");
                return;
              }
              saveMutation.mutate({ values: form, id: editing?.id });
            }}
          >
            <Field label="Channel name">
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="WALLORA News"
                required
              />
            </Field>
            <Field label="Group">
              <Input
                value={form.groupName}
                onChange={(event) => setForm({ ...form, groupName: event.target.value })}
                placeholder="News"
                required
              />
            </Field>
            <Field label="Stream URL" className="sm:col-span-2">
              <Input
                value={form.streamUrl}
                onChange={(event) => setForm({ ...form, streamUrl: event.target.value })}
                placeholder="https://…/stream.m3u8"
                className="font-mono text-xs"
                required
              />
            </Field>
            <Field label="Logo URL (optional)" className="sm:col-span-2">
              <Input
                value={form.logoUrl}
                onChange={(event) => setForm({ ...form, logoUrl: event.target.value })}
                placeholder="https://…/logo.png"
                className="font-mono text-xs"
              />
            </Field>
            <div className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2 sm:col-span-2">
              <div>
                <p className="text-xs font-medium">Feature in the app hero</p>
                <p className="text-[10px] text-secondary-text">
                  Pinned channels appear first in WALLORA TV.
                </p>
              </div>
              <Switch
                checked={form.isFeatured}
                onCheckedChange={(checked) => setForm({ ...form, isFeatured: checked })}
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Save changes" : "Add to database"}
              </Button>
              {editing && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditing(null);
                    setForm(EMPTY_FORM);
                  }}
                >
                  Cancel edit
                </Button>
              )}
            </div>
          </form>
        )}

        <form className="mb-4 flex flex-col gap-2 sm:flex-row" onSubmit={submitSearch}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary-text" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search channel name or group"
              className="pl-9"
            />
          </div>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as ChannelStatus | "all");
              setPage(1);
            }}
            className="h-9 rounded-md border border-border bg-background px-3 text-xs"
          >
            <option value="active">Active</option>
            <option value="hidden">Hidden</option>
            <option value="disabled">Disabled</option>
            <option value="all">All statuses</option>
          </select>
          <Button type="submit" variant="outline">
            Search
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["ak-channels"] })}
            aria-label="Refresh channels"
          >
            <RefreshCw className="size-4" />
          </Button>
        </form>

        {channelsQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs text-secondary-text">
            <Loader2 className="size-4 animate-spin" /> Loading channels…
          </div>
        ) : channelsQuery.isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
            {channelsQuery.error.message}
          </div>
        ) : channels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Tv className="mx-auto mb-3 size-8 text-secondary-text" />
            <p className="text-sm font-medium">No channels in this view</p>
            <p className="mt-1 text-xs text-secondary-text">
              Sync the M3U source above or add a channel manually.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="hidden grid-cols-[2fr_1fr_1fr_auto] gap-3 border-b border-border bg-muted/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-secondary-text md:grid">
              <span>Channel</span>
              <span>Group</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>
            {channels.map((channel) => {
              const hidden = channel.status === "hidden";
              return (
                <div
                  key={channel.id}
                  className="grid gap-3 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[2fr_1fr_1fr_auto] md:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {channel.logo ? (
                      <img
                        src={channel.logo}
                        alt=""
                        className="size-8 shrink-0 rounded-md bg-muted object-contain"
                      />
                    ) : (
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Tv className="size-4 text-secondary-text" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-semibold">{channel.name}</p>
                        {channel.isFeatured && (
                          <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />
                        )}
                      </div>
                      <p
                        className="truncate font-mono text-[10px] text-secondary-text"
                        title={channel.url}
                      >
                        {channel.url}
                      </p>
                    </div>
                  </div>
                  <p className="truncate text-xs text-secondary-text">{channel.group}</p>
                  <div>
                    <Badge
                      variant={
                        channel.status === "active" ? "default" : hidden ? "secondary" : "outline"
                      }
                      className="capitalize"
                    >
                      {channel.status ?? "active"}
                    </Badge>
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={channel.isFeatured ? "Remove from hero" : "Feature in hero"}
                      disabled={flagMutation.isPending}
                      onClick={() =>
                        flagMutation.mutate({
                          id: channel.id,
                          patch: { isFeatured: !channel.isFeatured },
                        })
                      }
                    >
                      <Star
                        className={cn(
                          "size-4",
                          channel.isFeatured && "fill-amber-400 text-amber-400",
                        )}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit channel"
                      onClick={() => startEdit(channel)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={hidden ? "Restore to app" : "Hide from app"}
                      disabled={flagMutation.isPending}
                      onClick={() =>
                        flagMutation.mutate({
                          id: channel.id,
                          patch: { status: hidden ? "active" : "hidden" },
                        })
                      }
                    >
                      <EyeOff className={cn("size-4", hidden && "text-emerald-500")} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-[11px] text-secondary-text">
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-secondary-text">
        {label}
      </span>
      {children}
    </label>
  );
}
