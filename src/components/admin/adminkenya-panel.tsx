"use client";

import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  BadgeCheck,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Crown,
  Cpu,
  Eye,
  FileClock,
  Gauge,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Stats = {
  totalUsers: number;
  totalWallpapers: number;
  pendingWallpapers: number;
  totalConversations: number;
  totalMessages: number;
  totalGenerations: number;
  totalComments: number;
  totalProducts: number;
  totalPurchases: number;
  totalWaitlistEntries: number;
  todayAiUsage: number;
  todayNewUsers: number;
  todayNewWallpapers: number;
  wallpapersByStatus: { approved: number; pending: number; rejected: number; flagged: number };
  topCategories: { id: string; slug: string; name: string; wallpaperCount: number }[];
};

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
  profile: {
    username: string;
    displayName: string | null;
    verified: boolean;
    creatorStatus: string;
    avatarUrl: string | null;
  } | null;
  wallpaperCount: number;
  conversationCount: number;
};

type AdminWallpaper = {
  id: string;
  slug: string;
  title: string;
  status: string;
  isPublic: boolean;
  sourceType: string;
  orientation: string;
  viewCount: number;
  likeCount: number;
  downloadCount: number;
  createdAt: string;
  category: { slug: string; name: string } | null;
  creator: {
    id: string;
    email: string;
    username: string | null;
    displayName: string | null;
    verified: boolean;
  };
  asset: { variant: string; objectKey: string } | null;
};

type AuditEntry = {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: string | null;
  createdAt: string;
};

type AIConfig = {
  textProvider: "zai" | "nvidia";
  textModel: string;
  imageProvider: "zai" | "nvidia";
  imageModel: string;
  nvidiaBaseUrl: string;
  temperature: number;
  maxTokens: number;
  updatedAt: string | null;
  updatedBy: string | null;
  nvidiaKeyConfigured: boolean;
  textModels: { id: string; provider: string; label: string; note: string }[];
  imageModels: { id: string; provider: string; label: string; note: string }[];
};

type TabId = "overview" | "uploads" | "verification" | "people" | "ai" | "audit";

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard; hint: string }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, hint: "Platform pulse" },
  { id: "uploads", label: "Uploads", icon: UploadCloud, hint: "Moderation queue" },
  { id: "verification", label: "Verification", icon: BadgeCheck, hint: "Badge applications" },
  { id: "people", label: "People & Roles", icon: Users, hint: "Roles & official tick" },
  { id: "ai", label: "AI & Models", icon: Cpu, hint: "NVIDIA / text / image" },
  { id: "audit", label: "Audit Log", icon: FileClock, hint: "Admin actions" },
];

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error?.message ?? `Request failed (${res.status})`);
  }
  return payload as T;
}

function fmt(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  if (!Number.isFinite(n)) return "∞";
  return new Intl.NumberFormat("en-US").format(n);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* -------------------------------------------------------------------------- */
/* Panel                                                                      */
/* -------------------------------------------------------------------------- */

export function AdminKenyaPanel({ user }: { user: { name: string; email: string } }) {
  const [tab, setTab] = useState<TabId>("overview");

  const statsQuery = useQuery<{ data: Stats }>({
    queryKey: ["ak-stats"],
    queryFn: () => jsonFetch("/api/v1/admin/stats"),
    refetchInterval: 60000,
  });

  const pending = statsQuery.data?.data.pendingWallpapers ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="size-5" />
            </div>
            <div className="leading-tight">
              <p className="font-display text-sm font-bold tracking-[0.18em]">WALLORA</p>
              <p className="text-[10px] uppercase tracking-[0.22em] text-secondary-text">
                Control Room · Kenya
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="hidden gap-1 bg-success/15 text-success sm:flex">
              <ShieldCheck className="size-3" /> Super Admin
            </Badge>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium">{user.name}</p>
              <p className="text-[10px] text-secondary-text">{user.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-secondary-text"
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        {/* sidebar */}
        <nav className="flex gap-2 overflow-x-auto lg:w-60 lg:shrink-0 lg:flex-col lg:overflow-visible">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex min-w-max items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition",
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-transparent bg-surface text-secondary-text hover:border-border hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="whitespace-nowrap">{t.label}</span>
                {t.id === "uploads" && pending > 0 && (
                  <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {pending}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* content */}
        <main className="min-w-0 flex-1">
          {tab === "overview" && <OverviewTab query={statsQuery} />}
          {tab === "uploads" && <UploadsTab />}
          {tab === "verification" && <VerificationTab />}
          {tab === "people" && <PeopleTab />}
          {tab === "ai" && <AITab />}
          {tab === "audit" && <AuditTab />}
        </main>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */

function OverviewTab({
  query,
}: {
  query: {
    data?: { data: Stats };
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
  };
}) {
  const { data, isLoading, isError, refetch } = query;
  const s = data?.data;

  if (isLoading) return <LoadingBlock label="Loading platform telemetry…" />;
  if (isError || !s) return <ErrorBlock message="Could not load stats." onRetry={() => refetch()} />;

  const cards = [
    { label: "Users", value: fmt(s.totalUsers), icon: Users },
    { label: "Wallpapers", value: fmt(s.totalWallpapers), icon: ImageIcon },
    { label: "Pending review", value: fmt(s.pendingWallpapers), icon: UploadCloud, accent: true },
    { label: "AI conversations", value: fmt(s.totalConversations), icon: Bot },
    { label: "AI messages", value: fmt(s.totalMessages), icon: Activity },
    { label: "AI generations", value: fmt(s.totalGenerations), icon: Sparkles },
    { label: "Comments", value: fmt(s.totalComments), icon: Eye },
    { label: "Waitlist", value: fmt(s.totalWaitlistEntries), icon: Users },
    { label: "Products", value: fmt(s.totalProducts), icon: ImageIcon },
    { label: "Purchases", value: fmt(s.totalPurchases), icon: Gauge },
  ];

  const statuses = s.wallpapersByStatus;
  const statusTotal =
    statuses.approved + statuses.pending + statuses.rejected + statuses.flagged || 1;

  return (
    <div className="space-y-6">
      <SectionTitle title="Platform overview" subtitle="Live counts straight from the production database." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className={cn(
                "rounded-2xl border bg-surface p-4",
                c.accent ? "border-primary/40" : "border-border",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-secondary-text">{c.label}</p>
                <Icon className={cn("size-4", c.accent ? "text-primary" : "text-secondary-text")} />
              </div>
              <p className="mt-2 font-display text-2xl font-bold">{c.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Today">
          <Metric label="AI credits used" value={fmt(s.todayAiUsage)} />
          <Metric label="New users" value={fmt(s.todayNewUsers)} />
          <Metric label="New wallpapers" value={fmt(s.todayNewWallpapers)} />
        </Panel>
        <Panel title="Wallpaper status mix">
          <div className="space-y-2.5 pt-1">
            {(["approved", "pending", "rejected", "flagged"] as const).map((k) => (
              <div key={k} className="flex items-center gap-3">
                <span className="w-20 text-xs capitalize text-secondary-text">{k}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      k === "approved" ? "bg-success" : k === "pending" ? "bg-primary" : "bg-destructive",
                    )}
                    style={{ width: `${(statuses[k] / statusTotal) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-medium">{statuses[k]}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Top categories">
          {s.topCategories.length === 0 ? (
            <p className="text-sm text-secondary-text">No categories yet.</p>
          ) : (
            <div className="space-y-2.5 pt-1">
              {s.topCategories.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span>{c.name}</span>
                  <Badge variant="secondary">{c.wallpaperCount}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Uploads / moderation                                                       */
/* -------------------------------------------------------------------------- */

function UploadsTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const limit = 24;

  const query = useQuery<{ data: { items: AdminWallpaper[]; pagination: { page: number; totalPages: number; total: number } } }>({
    queryKey: ["ak-wallpapers", status, page],
    queryFn: () =>
      jsonFetch(`/api/v1/admin/wallpapers?status=${status}&page=${page}&limit=${limit}`),
    placeholderData: keepPreviousData,
  });

  const moderate = useMutation({
    mutationFn: ({ id, next }: { id: string; next: "approved" | "rejected" | "flagged" }) =>
      jsonFetch(`/api/v1/admin/wallpapers/${id}/moderate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      }),
    onSuccess: (_d, v) => {
      toast.success(`Wallpaper ${v.next}`);
      qc.invalidateQueries({ queryKey: ["ak-wallpapers"] });
      qc.invalidateQueries({ queryKey: ["ak-stats"] });
      // Publish immediately for anyone with Discover already open.
      qc.invalidateQueries({ queryKey: ["wallpapers"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: Error) => toast.error("Moderation failed", { description: e.message }),
  });

  const repair = useMutation({
    mutationFn: () =>
      jsonFetch<{ data: { repaired: number } }>("/api/v1/admin/maintenance/repair-uploads", {
        method: "POST",
      }),
    onSuccess: (payload) => {
      toast.success(`Repaired ${payload.data?.repaired ?? 0} approved upload(s)`);
      qc.invalidateQueries({ queryKey: ["ak-wallpapers"] });
      qc.invalidateQueries({ queryKey: ["wallpapers"] });
    },
    onError: (e: Error) => toast.error("Repair failed", { description: e.message }),
  });

  const items = query.data?.data.items ?? [];
  const pagination = query.data?.data.pagination;

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Upload moderation"
        subtitle="Review creator submissions before they appear in Discover."
      />
      <div className="flex flex-wrap gap-2">
        {["pending", "approved", "rejected", "flagged"].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? "default" : "outline"}
            onClick={() => { setStatus(s); setPage(1); }}
            className="capitalize"
          >
            {s}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => query.refetch()}>
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={repair.isPending}
          onClick={() => repair.mutate()}
          title="Publish older approvals that were approved before this bug was fixed"
        >
          <RefreshCw className={cn("size-3.5", repair.isPending && "animate-spin")} /> Repair old approvals
        </Button>
      </div>

      {query.isLoading ? (
        <LoadingBlock label="Loading submissions…" />
      ) : items.length === 0 ? (
        <EmptyBlock title="Nothing here" subtitle={`No ${status} wallpapers.`} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((w) => (
              <div key={w.id} className="overflow-hidden rounded-2xl border border-border bg-surface">
                <div className="relative aspect-[4/3] bg-raised">
                  {w.asset?.objectKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.asset.objectKey} alt={w.title} className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-secondary-text">
                      <ImageIcon className="size-8" />
                    </div>
                  )}
                  <div className="absolute left-2 top-2 flex gap-1">
                    <Badge className="capitalize">{w.status}</Badge>
                    {!w.isPublic && <Badge variant="secondary">private</Badge>}
                    {w.creator.verified && (
                      <Badge variant="secondary" className="gap-1">
                        <BadgeCheck className="size-3" /> verified
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <p className="truncate font-medium">{w.title}</p>
                    <p className="truncate text-xs text-secondary-text">
                      @{w.creator.username ?? w.creator.displayName ?? "creator"}{" "}
                      {w.category ? `· ${w.category.name}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={moderate.isPending}
                      onClick={() => moderate.mutate({ id: w.id, next: "approved" })}
                    >
                      <Check className="size-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={moderate.isPending}
                      onClick={() => moderate.mutate({ id: w.id, next: "rejected" })}
                    >
                      <X className="size-3.5" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={moderate.isPending}
                      onClick={() => moderate.mutate({ id: w.id, next: "flagged" })}
                      title="Flag"
                    >
                      <CircleAlert className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Pager
            page={pagination?.page ?? page}
            totalPages={pagination?.totalPages ?? 1}
            total={pagination?.total ?? 0}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Verification applications                                                  */
/* -------------------------------------------------------------------------- */

type VerificationRequest = {
  id: string;
  userId: string;
  tier: "verified" | "premium";
  reason: string;
  portfolio: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  note: string | null;
  email: string | null;
  username: string | null;
  displayName: string | null;
};

function VerificationTab() {
  const qc = useQueryClient();
  const query = useQuery<{ data: { requests: VerificationRequest[] } }>({
    queryKey: ["ak-verification"],
    queryFn: () => jsonFetch("/api/v1/admin/verification"),
  });

  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) =>
      jsonFetch(`/api/v1/admin/verification/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      }),
    onSuccess: (_d, v) => {
      toast.success(`Application ${v.decision}`);
      qc.invalidateQueries({ queryKey: ["ak-verification"] });
      qc.invalidateQueries({ queryKey: ["ak-users"] });
    },
    onError: (e: Error) => toast.error("Review failed", { description: e.message }),
  });

  const requests = query.data?.data.requests ?? [];
  const pending = requests.filter((r) => r.status === "pending").length;

  if (query.isLoading) return <LoadingBlock label="Loading verification applications…" />;
  if (query.isError) return <ErrorBlock message="Could not load applications." onRetry={() => query.refetch()} />;

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Verification applications"
        subtitle="Real review queue. Approving grants the blue tick or premium gold badge instantly."
      />
      <div className="flex items-center gap-2">
        <Badge variant="default">{pending} pending</Badge>
        <Badge variant="secondary">{requests.length} total</Badge>
        <Button size="sm" variant="ghost" onClick={() => query.refetch()}>
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      {requests.length === 0 ? (
        <Panel title="No applications yet">
          <p className="text-sm text-secondary-text">
            Users can apply at <code className="text-primary">/verification</code>. Requests will appear here.
          </p>
        </Panel>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {r.tier === "premium" ? <Crown className="size-4 text-[#D7B879]" /> : <BadgeCheck className="size-4 text-[#3B9EFF]" />}
                    {r.displayName || r.username || r.email || "Applicant"}
                    <Badge
                      variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}
                    >
                      {r.status}
                    </Badge>
                  </p>
                  <p className="mt-0.5 text-[11px] text-secondary-text">
                    @{r.username || "unknown"} · {r.email} · applied {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ id: r.id, decision: "approved" })}
                    >
                      <Check className="size-3.5" /> Approve {r.tier}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ id: r.id, decision: "rejected" })}
                    >
                      <X className="size-3.5" /> Reject
                    </Button>
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-secondary-text">
                <span className="text-foreground">Why:</span> {r.reason}
              </p>
              <p className="mt-1 break-all text-xs text-secondary-text">
                <span className="text-foreground">Work:</span> {r.portfolio}
              </p>
              {r.note && <p className="mt-2 text-xs text-muted-foreground">Review note: {r.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* People & roles                                                             */
/* -------------------------------------------------------------------------- */

function PeopleTab() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const limit = 50;

  const query = useQuery<{ data: { items: AdminUser[]; pagination: { page: number; totalPages: number; total: number } } }>({
    queryKey: ["ak-users", page],
    queryFn: () => jsonFetch(`/api/v1/admin/users?page=${page}&limit=${limit}`),
    placeholderData: keepPreviousData,
  });

  const patchUser = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      jsonFetch(`/api/v1/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      toast.success("Account updated");
      qc.invalidateQueries({ queryKey: ["ak-users"] });
      qc.invalidateQueries({ queryKey: ["ak-stats"] });
    },
    onError: (e: Error) => toast.error("Update failed", { description: e.message }),
  });

  const items = useMemo(() => {
    const all = query.data?.data.items ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.name?.toLowerCase().includes(q) ||
        u.profile?.username?.toLowerCase().includes(q),
    );
  }, [query.data, search]);

  const pagination = query.data?.data.pagination;

  return (
    <div className="space-y-5">
      <SectionTitle
        title="People & verification"
        subtitle="Grant the official WALLORA tick, manage roles and creator status."
      />
      <div className="max-w-sm">
        <Input
          placeholder="Search email, name or username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {query.isLoading ? (
        <LoadingBlock label="Loading people…" />
      ) : items.length === 0 ? (
        <EmptyBlock title="No people found" subtitle="Try a different search or page." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-raised text-xs uppercase tracking-wide text-secondary-text">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Verified</th>
                <th className="px-4 py-3">Creator</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Uploads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((u) => (
                <tr key={u.id} className="hover:bg-raised/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                        {(u.profile?.displayName ?? u.name ?? u.email).slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 truncate font-medium">
                          {u.profile?.displayName ?? u.name ?? "Unnamed"}
                          {u.profile?.verified && (
                            <BadgeCheck className="size-3.5 shrink-0 text-primary" />
                          )}
                        </p>
                        <p className="truncate text-xs text-secondary-text">
                          @{u.profile?.username ?? "—"} · {u.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={!!u.profile?.verified}
                      disabled={patchUser.isPending}
                      onCheckedChange={(checked) =>
                        patchUser.mutate({ id: u.id, patch: { verified: checked } })
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={u.profile?.creatorStatus ?? "none"}
                      onValueChange={(creatorStatus) =>
                        patchUser.mutate({ id: u.id, patch: { creatorStatus } })
                      }
                    >
                      <SelectTrigger className="h-8 w-28 text-xs capitalize">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["none", "pending", "approved", "rejected"].map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={u.role}
                      onValueChange={(role) => patchUser.mutate({ id: u.id, patch: { role } })}
                    >
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["user", "creator", "moderator", "admin", "super_admin"].map((r) => (
                          <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        u.status === "active" ? "default" : "destructive"
                      }
                      className="capitalize"
                    >
                      {u.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-secondary-text">{u.wallpaperCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        page={pagination?.page ?? page}
        totalPages={pagination?.totalPages ?? 1}
        total={pagination?.total ?? 0}
        onPage={setPage}
      />
      <p className="text-xs text-secondary-text">
        Role changes take effect for that account after they sign out and back in.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* AI & Models                                                                */
/* -------------------------------------------------------------------------- */

function AITab() {
  const qc = useQueryClient();
  const query = useQuery<{ data: AIConfig }>({
    queryKey: ["ak-ai-config"],
    queryFn: () => jsonFetch("/api/v1/admin/ai-config"),
  });

  const [draft, setDraft] = useState<Partial<AIConfig> | null>(null);
  const [testResult, setTestResult] = useState<{
    keyConfigured: boolean;
    models: string[];
    modelTest: { model: string; ok: boolean; detail: string };
  } | null>(null);
  const config = { ...(query.data?.data ?? ({} as AIConfig)), ...(draft ?? {}) } as AIConfig;

  const test = useMutation({
    mutationFn: () =>
      jsonFetch<{ data: typeof testResult }>("/api/v1/admin/ai-config/test", {
        method: "POST",
      }),
    onSuccess: (payload) => {
      setTestResult(payload.data);
      if (payload.data?.modelTest?.ok) toast.success("NVIDIA connection OK");
      else toast.error("NVIDIA test failed", { description: payload.data?.modelTest?.detail });
    },
    onError: (e: Error) => toast.error("Test failed", { description: e.message }),
  });

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      jsonFetch("/api/v1/admin/ai-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      toast.success("AI configuration saved", {
        description: "New chats and generations will use the selected models.",
      });
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["ak-ai-config"] });
    },
    onError: (e: Error) => toast.error("Could not save", { description: e.message }),
  });

  if (query.isLoading) return <LoadingBlock label="Loading AI configuration…" />;
  if (query.isError || !query.data) {
    return <ErrorBlock message="Could not load AI configuration." onRetry={() => query.refetch()} />;
  }

  const dirty = !!draft && Object.keys(draft).length > 0;
  const set = (patch: Partial<AIConfig>) => setDraft((d) => ({ ...(d ?? {}), ...patch }));

  return (
    <div className="space-y-6">
      <SectionTitle
        title="AI providers & models"
        subtitle="Choose which engine powers chat, prompt enhancement and image generation."
      />

      <Panel
        title="NVIDIA NIM"
        subtitle="Set NVIDIA_API_KEY in Vercel environment variables — it is never exposed to the browser."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <KeyRound className="size-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">API key</p>
              <p className="text-xs text-secondary-text">
                {config.nvidiaKeyConfigured
                  ? "Configured on the server ✓"
                  : "Not configured — add NVIDIA_API_KEY in Vercel"}
              </p>
            </div>
          </div>
          <Badge variant={config.nvidiaKeyConfigured ? "default" : "destructive"}>
            {config.nvidiaKeyConfigured ? "Active" : "Missing"}
          </Badge>
        </div>
        <div className="mt-4">
          <label className="text-xs text-secondary-text">NVIDIA base URL</label>
          <Input
            className="mt-1"
            value={config.nvidiaBaseUrl ?? ""}
            onChange={(e) => set({ nvidiaBaseUrl: e.target.value })}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            disabled={test.isPending || !config.nvidiaKeyConfigured}
            onClick={() => { setTestResult(null); test.mutate(); }}
          >
            {test.isPending ? <Loader2 className="size-4 animate-spin" /> : <Activity className="size-4" />}
            Test connection
          </Button>
          {testResult && (
            <Badge variant={testResult.modelTest.ok ? "default" : "destructive"}>
              {testResult.modelTest.ok ? "Working" : "Failed"}
            </Badge>
          )}
        </div>
        {testResult && (
          <div className="mt-3 space-y-1 rounded-xl border border-border bg-raised p-3 text-xs text-secondary-text">
            <p>
              <span className="text-foreground">Model:</span> {testResult.modelTest.model}
            </p>
            <p className="break-words">
              <span className="text-foreground">Result:</span> {testResult.modelTest.detail}
            </p>
            <p>
              <span className="text-foreground">Available models:</span> {testResult.models.length}
            </p>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Text & chat" subtitle="Powers WALLORA AI conversations and prompt enhancement.">
          <div className="space-y-4">
            <ModelSelect
              label="Text provider"
              value={config.textProvider}
              onChange={(textProvider) =>
                set({
                  textProvider: textProvider as AIConfig["textProvider"],
                  textModel:
                    textProvider === "nvidia"
                      ? config.textModels.find((m) => m.provider === "nvidia")?.id ?? config.textModel
                      : "zai:auto",
                })
              }
              options={[
                { value: "zai", label: "ZAI Web Dev SDK (current)" },
                { value: "nvidia", label: "NVIDIA NIM" },
              ]}
            />
            <ModelSelect
              label="Text model"
              value={config.textModel}
              onChange={(textModel) => set({ textModel, textProvider: textModel.includes("/") ? "nvidia" : "zai" })}
              options={config.textModels.map((m) => ({
                value: m.id,
                label: `${m.label} · ${m.note}`,
              }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-secondary-text">Temperature</label>
                <Input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  className="mt-1"
                  value={config.temperature ?? 0.7}
                  onChange={(e) => set({ temperature: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-xs text-secondary-text">Max tokens</label>
                <Input
                  type="number"
                  min={256}
                  max={8192}
                  step={256}
                  className="mt-1"
                  value={config.maxTokens ?? 2048}
                  onChange={(e) => set({ maxTokens: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Image generation" subtitle="Powers the AI Studio image outputs. NVIDIA NIM currently has no image endpoint on this key, so images stay on ZAI.">
          <div className="space-y-4">
            <ModelSelect
              label="Image provider"
              value={config.imageProvider}
              onChange={(imageProvider) =>
                set({
                  imageProvider: imageProvider as AIConfig["imageProvider"],
                  imageModel:
                    imageProvider === "nvidia"
                      ? config.imageModels.find((m) => m.provider === "nvidia")?.id ?? config.imageModel
                      : "zai:auto",
                })
              }
              options={[
                { value: "zai", label: "ZAI Web Dev SDK (current)" },
                { value: "nvidia", label: "NVIDIA NIM" },
              ]}
            />
            <ModelSelect
              label="Image model"
              value={config.imageModel}
              onChange={(imageModel) => set({ imageModel, imageProvider: imageModel.includes("/") ? "nvidia" : "zai" })}
              options={config.imageModels.map((m) => ({
                value: m.id,
                label: `${m.label} · ${m.note}`,
              }))}
            />
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-secondary-text">
              If NVIDIA is selected but the key is missing, generation fails and credits are
              refunded automatically. The panel stays on the current model until you save.
            </div>
          </div>
        </Panel>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-secondary-text">
          {config.updatedAt
            ? `Last changed ${timeAgo(config.updatedAt)}${config.updatedBy ? ` by ${config.updatedBy.slice(0, 8)}…` : ""}`
            : "Using default configuration"}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" disabled={!dirty} onClick={() => setDraft(null)}>
            Discard
          </Button>
          <Button
            size="sm"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate({ ...(draft ?? {}) } as Record<string, unknown>)}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Save configuration
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Audit log                                                                  */
/* -------------------------------------------------------------------------- */

function AuditTab() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const query = useQuery<{ data: { items: AuditEntry[]; pagination: { page: number; totalPages: number; total: number } } }>({
    queryKey: ["ak-audit", page],
    queryFn: () => jsonFetch(`/api/v1/admin/audit-logs?page=${page}&limit=${limit}`),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.data.items ?? [];
  const pagination = query.data?.data.pagination;

  return (
    <div className="space-y-5">
      <SectionTitle title="Audit log" subtitle="Every privileged action, recorded." />
      {query.isLoading ? (
        <LoadingBlock label="Loading audit log…" />
      ) : items.length === 0 ? (
        <EmptyBlock title="No actions yet" subtitle="Admin actions will appear here." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-raised text-xs uppercase tracking-wide text-secondary-text">
              <tr>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((a) => (
                <tr key={a.id} className="hover:bg-raised/50">
                  <td className="px-4 py-3 font-mono text-xs">{a.action}</td>
                  <td className="px-4 py-3 text-xs text-secondary-text">
                    {a.targetType ?? "—"}{a.targetId ? ` · ${a.targetId.slice(0, 8)}` : ""}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-secondary-text">
                    {a.metadata ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-secondary-text">{timeAgo(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        page={pagination?.page ?? page}
        totalPages={pagination?.totalPages ?? 1}
        total={pagination?.total ?? 0}
        onPage={setPage}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared UI                                                                  */
/* -------------------------------------------------------------------------- */

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="font-display text-xl font-bold sm:text-2xl">{title}</h1>
      <p className="mt-1 text-sm text-secondary-text">{subtitle}</p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-display font-semibold">{title}</h2>
      {subtitle && <p className="mt-1 text-xs text-secondary-text">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 last:border-0">
      <span className="text-xs text-secondary-text">{label}</span>
      <span className="font-display text-lg font-bold">{value}</span>
    </div>
  );
}

function ModelSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs text-secondary-text">{label}</label>
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger className="mt-1 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Pager({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2 text-xs text-secondary-text">
      <span>
        {fmt(total)} records · page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="size-4" /> Prev
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center gap-3 rounded-2xl border border-border bg-surface text-sm text-secondary-text">
      <Loader2 className="size-5 animate-spin text-primary" /> {label}
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-surface text-sm">
      <CircleAlert className="size-6 text-destructive" />
      <p>{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="size-4" /> Try again
      </Button>
    </div>
  );
}

function EmptyBlock({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-surface text-center">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-secondary-text">{subtitle}</p>
    </div>
  );
}
