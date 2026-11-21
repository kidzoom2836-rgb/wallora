"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DashboardIcon,
  UserIcon,
  ImageIcon,
  CheckIcon,
  AlertIcon,
  LoaderIcon,
  EyeIcon,
} from "@/components/icons/wallora-icons";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types — match the real /api/v1/admin/* responses
// ---------------------------------------------------------------------------

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
  wallpapersByStatus: {
    approved: number;
    pending: number;
    rejected: number;
    flagged: number;
  };
  topCategories: Array<{
    id: string;
    slug: string;
    name: string;
    icon: string | null;
    wallpaperCount: number;
  }>;
};

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
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
  description: string | null;
  status: string;
  license: string;
  orientation: string;
  dominantColor: string | null;
  sourceType: string;
  isPublic: boolean;
  viewCount: number;
  likeCount: number;
  downloadCount: number;
  favoriteCount: number;
  createdAt: string;
  category: { slug: string; name: string } | null;
  creator: {
    id: string;
    email: string;
    username: string | null;
    displayName: string | null;
    verified: boolean;
    avatarUrl: string | null;
  };
  asset: {
    variant: string;
    objectKey: string;
    width: number;
    height: number;
  } | null;
  tags: Array<{ slug: string; name: string }>;
};

type TabId = "overview" | "users" | "moderation";

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

const MOD_STATUS_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "flagged", label: "Flagged" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [tab, setTab] = React.useState<TabId>("overview");

  const role = session?.user?.role;
  const isAdmin =
    status === "authenticated" && !!role && ADMIN_ROLES.has(role);
  const sessionLoading = status === "loading";

  return (
    <div className="bg-background p-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">
              Admin Dashboard
            </h1>
            <p className="mt-1 text-sm text-secondary-text">
              Platform metrics, user management, and content moderation.
            </p>
          </div>
          {isAdmin && (
            <Badge
              variant="outline"
              className="w-fit border-primary/30 bg-primary/10 text-[11px] font-medium capitalize text-primary"
            >
              {role}
            </Badge>
          )}
        </header>

        {/* Body */}
        {sessionLoading ? (
          <CenteredSpinner label="Checking your session…" />
        ) : !isAdmin ? (
          <AccessDenied />
        ) : (
          <>
            {/* Tab navigation */}
            <nav
              role="tablist"
              aria-label="Admin sections"
              className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1"
            >
              <TabButton
                active={tab === "overview"}
                onClick={() => setTab("overview")}
              >
                <DashboardIcon className="h-4 w-4" />
                Overview
              </TabButton>
              <TabButton
                active={tab === "users"}
                onClick={() => setTab("users")}
              >
                <UserIcon className="h-4 w-4" />
                Users
              </TabButton>
              <TabButton
                active={tab === "moderation"}
                onClick={() => setTab("moderation")}
              >
                <ImageIcon className="h-4 w-4" />
                Moderation
                <PendingCountBadge />
              </TabButton>
            </nav>

            {/* Tab content */}
            <section>
              {tab === "overview" ? (
                <OverviewTab />
              ) : tab === "users" ? (
                <UsersTab />
              ) : (
                <ModerationTab />
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-raised text-foreground"
          : "text-secondary-text hover:bg-raised/60 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function PendingCountBadge() {
  const { data } = useQuery<{ data: Stats }>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch("/api/v1/admin/stats");
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });
  const pending = data?.data?.pendingWallpapers ?? 0;
  if (pending === 0) return null;
  return (
    <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/20 px-1 text-[10px] font-semibold text-primary">
      {pending}
    </span>
  );
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface px-6 py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertIcon className="h-8 w-8" />
      </span>
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">
          Access denied — admin role required.
        </h2>
        <p className="mt-1 max-w-md text-sm text-secondary-text">
          This dashboard is restricted to admin and super_admin accounts. Your
          current session does not have the required permissions.
        </p>
      </div>
    </div>
  );
}

function CenteredSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-6 py-20 text-center">
      <LoaderIcon className="h-6 w-6 animate-spin text-primary" />
      {label && <p className="text-sm text-secondary-text">{label}</p>}
    </div>
  );
}

function ErrorState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertIcon className="h-6 w-6" />
      </span>
      <p className="text-sm text-secondary-text">
        {message ?? "Failed to load data. Please try again."}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-raised text-secondary-text">
        <CheckIcon className="h-6 w-6" />
      </span>
      <p className="font-display text-sm font-semibold text-foreground">
        {title}
      </p>
      {subtitle && (
        <p className="max-w-xs text-xs text-secondary-text">{subtitle}</p>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Prev
      </Button>
      <span className="text-xs tabular-nums text-secondary-text">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------

function OverviewTab() {
  const { data, isLoading, isError } = useQuery<{ data: Stats }>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch("/api/v1/admin/stats");
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  if (isError) return <ErrorState message="Failed to load metrics." />;
  if (isLoading || !data) return <StatsSkeleton />;

  const s = data.data;

  const cards: Array<{ label: string; value: number }> = [
    { label: "Total Users", value: s.totalUsers },
    { label: "Wallpapers", value: s.totalWallpapers },
    { label: "Pending Review", value: s.pendingWallpapers },
    { label: "AI Conversations", value: s.totalConversations },
    { label: "AI Messages", value: s.totalMessages },
    { label: "AI Generations", value: s.totalGenerations },
    { label: "Comments", value: s.totalComments },
    { label: "Products", value: s.totalProducts },
    { label: "Purchases", value: s.totalPurchases },
    { label: "Waitlist Entries", value: s.totalWaitlistEntries },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} />
        ))}
      </div>

      {/* Today + status breakdown + top categories */}
      <div className="grid gap-4 md:grid-cols-3">
        <TodayCard stats={s} />
        <StatusBreakdownCard data={s.wallpapersByStatus} />
        <TopCategoriesCard categories={s.topCategories} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/20">
      <p className="font-display text-2xl font-semibold tabular-nums text-foreground">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-xs uppercase tracking-wide text-secondary-text">
        {label}
      </p>
    </div>
  );
}

function TodayCard({ stats }: { stats: Stats }) {
  const rows: Array<{ label: string; value: number }> = [
    { label: "AI credits used", value: stats.todayAiUsage },
    { label: "New users", value: stats.todayNewUsers },
    { label: "New wallpapers", value: stats.todayNewWallpapers },
  ];
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="font-display text-sm font-semibold text-foreground">
        Today
      </h3>
      <dl className="mt-4 space-y-3">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between text-xs"
          >
            <dt className="text-secondary-text">{r.label}</dt>
            <dd className="tabular-nums font-semibold text-foreground">
              {r.value.toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function StatusBreakdownCard({
  data,
}: {
  data: { approved: number; pending: number; rejected: number; flagged: number };
}) {
  const rows: Array<{
    key: string;
    label: string;
    value: number;
    color: string;
  }> = [
    { key: "approved", label: "Approved", value: data.approved, color: "bg-success" },
    { key: "pending", label: "Pending", value: data.pending, color: "bg-primary" },
    { key: "rejected", label: "Rejected", value: data.rejected, color: "bg-destructive" },
    { key: "flagged", label: "Flagged", value: data.flagged, color: "bg-secondary-text" },
  ];
  const total = rows.reduce((acc, r) => acc + r.value, 0) || 1;
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="font-display text-sm font-semibold text-foreground">
        Wallpaper status
      </h3>
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-raised">
        {rows.map(
          (r) =>
            r.value > 0 && (
              <div
                key={r.key}
                className={cn("h-full", r.color)}
                style={{ width: `${(r.value / total) * 100}%` }}
                title={`${r.label}: ${r.value}`}
              />
            ),
        )}
      </div>
      <dl className="mt-4 space-y-2.5">
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex items-center justify-between text-xs"
          >
            <dt className="flex items-center gap-2 text-secondary-text">
              <span className={cn("h-2 w-2 rounded-full", r.color)} />
              {r.label}
            </dt>
            <dd className="tabular-nums font-medium text-foreground">
              {r.value.toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TopCategoriesCard({
  categories,
}: {
  categories: Stats["topCategories"];
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="font-display text-sm font-semibold text-foreground">
        Top categories
      </h3>
      {categories.length === 0 ? (
        <p className="mt-4 text-xs text-secondary-text">
          No categories yet.
        </p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {categories.map((c, i) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-raised text-[10px] font-semibold text-secondary-text">
                  {i + 1}
                </span>
                <span className="truncate font-medium text-foreground">
                  {c.name}
                </span>
              </div>
              <span className="shrink-0 tabular-nums text-secondary-text">
                {c.wallpaperCount.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-border bg-surface"
          />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-44 animate-pulse rounded-xl border border-border bg-surface"
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users tab
// ---------------------------------------------------------------------------

function UsersTab() {
  const [page, setPage] = React.useState(1);
  const limit = 50;

  const { data, isLoading, isError } = useQuery<{
    data: { items: AdminUser[]; pagination: Pagination };
  }>({
    queryKey: ["admin-users", page],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/admin/users?page=${page}&limit=${limit}`,
      );
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const items = data?.data.items ?? [];
  const pagination = data?.data.pagination;

  if (isError) return <ErrorState message="Failed to load users." />;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold text-foreground">
          Users
        </h2>
        <p className="text-xs text-secondary-text">
          {pagination
            ? `Showing ${items.length} of ${pagination.total.toLocaleString()} users`
            : "Loading…"}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg border border-border bg-surface"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No users found"
          subtitle="The user table is empty."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
            <div className="max-h-[70vh] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-border bg-raised text-[11px] uppercase tracking-wider text-secondary-text">
                  <tr>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Wallpapers
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Conversations
                    </th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((u) => (
                    <UserRow key={u.id} user={u} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile list */}
          <ul className="max-h-[70vh] space-y-2 overflow-y-auto md:hidden">
            {items.map((u) => (
              <li
                key={u.id}
                className="rounded-lg border border-border bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {u.profile?.displayName ||
                        u.profile?.username ||
                        u.name ||
                        "Unnamed"}
                    </p>
                    <p className="truncate text-xs text-secondary-text">
                      {u.email}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <RoleBadge role={u.role} />
                    <StatusBadge status={u.status} />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-secondary-text">
                  <span>{u.wallpaperCount} wallpapers</span>
                  <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                </div>
              </li>
            ))}
          </ul>

          {pagination && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const display =
    user.profile?.displayName ||
    user.profile?.username ||
    user.name ||
    "Unnamed";
  const initial = (
    user.profile?.username?.[0] ??
    user.email?.[0] ??
    "?"
  ).toUpperCase();

  return (
    <tr className="transition-colors hover:bg-raised/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
            {initial}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-foreground">
                {display}
              </span>
              {user.profile?.verified && (
                <CheckIcon
                  className="h-3 w-3 shrink-0 text-primary"
                  aria-label="Verified"
                />
              )}
            </div>
            <p className="truncate text-xs text-secondary-text">
              {user.email}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <RoleBadge role={user.role} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={user.status} />
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-sm text-foreground">
        {user.wallpaperCount.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-sm text-foreground">
        {user.conversationCount.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-xs text-secondary-text">
        {new Date(user.createdAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </td>
    </tr>
  );
}

function RoleBadge({ role }: { role: string }) {
  const variant =
    role === "super_admin" || role === "admin"
      ? "default"
      : role === "moderator"
        ? "secondary"
        : "outline";
  return (
    <Badge variant={variant} className="capitalize">
      {role.replace("_", " ")}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "active"
      ? "default"
      : status === "suspended" || status === "banned"
        ? "destructive"
        : "outline";
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Moderation tab
// ---------------------------------------------------------------------------

function ModerationTab() {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<string>("pending");
  const [page, setPage] = React.useState(1);
  const limit = 24;

  const { data, isLoading, isError } = useQuery<{
    data: { items: AdminWallpaper[]; pagination: Pagination };
  }>({
    queryKey: ["admin-wallpapers", status, page],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/admin/wallpapers?status=${status}&page=${page}&limit=${limit}`,
      );
      if (!res.ok) throw new Error("Failed to load wallpapers");
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const moderateMutation = useMutation({
    mutationFn: async ({
      id,
      nextStatus,
    }: {
      id: string;
      nextStatus: "approved" | "rejected" | "flagged";
    }) => {
      const res = await fetch(`/api/v1/admin/wallpapers/${id}/moderate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error?.message ?? "Moderation failed");
      }
      return payload;
    },
    onSuccess: (_data, vars) => {
      toast.success(`Wallpaper ${vars.nextStatus}`, {
        description: "The moderation decision has been recorded.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-wallpapers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["wallpapers"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err: Error) => {
      toast.error("Moderation failed", { description: err.message });
    },
  });

  const items = data?.data.items ?? [];
  const pagination = data?.data.pagination;

  // Reset to page 1 whenever the status filter changes.
  React.useEffect(() => {
    setPage(1);
  }, [status]);

  if (isError) return <ErrorState message="Failed to load wallpapers." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">
            Moderation queue
          </h2>
          <p className="mt-0.5 text-xs text-secondary-text">
            Review and act on wallpaper submissions.
          </p>
        </div>
        <div
          role="group"
          aria-label="Filter by status"
          className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1"
        >
          {MOD_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              aria-pressed={status === opt.id}
              onClick={() => setStatus(opt.id)}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                status === opt.id
                  ? "bg-raised text-foreground"
                  : "text-secondary-text hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/5] animate-pulse rounded-xl border border-border bg-surface"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          subtitle={`No wallpapers with status "${status}".`}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((w) => (
              <ModerationCard
                key={w.id}
                wallpaper={w}
                pendingAction={
                  moderateMutation.isPending
                    ? moderateMutation.variables?.id === w.id
                      ? moderateMutation.variables?.nextStatus
                      : null
                    : null
                }
                onApprove={() =>
                  moderateMutation.mutate({ id: w.id, nextStatus: "approved" })
                }
                onReject={() =>
                  moderateMutation.mutate({ id: w.id, nextStatus: "rejected" })
                }
                onFlag={() =>
                  moderateMutation.mutate({ id: w.id, nextStatus: "flagged" })
                }
              />
            ))}
          </div>

          {pagination && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

function ModerationCard({
  wallpaper,
  pendingAction,
  onApprove,
  onReject,
  onFlag,
}: {
  wallpaper: AdminWallpaper;
  pendingAction: "approved" | "rejected" | "flagged" | null;
  onApprove: () => void;
  onReject: () => void;
  onFlag: () => void;
}) {
  const aspectClass =
    wallpaper.orientation === "portrait"
      ? "aspect-[3/4]"
      : wallpaper.orientation === "landscape"
        ? "aspect-[16/10]"
        : "aspect-square";

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className={cn("relative overflow-hidden bg-raised", aspectClass)}>
        {wallpaper.asset ? (
          <img
            src={wallpaper.asset.objectKey}
            alt={wallpaper.title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-secondary-text">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
        <div className="absolute left-1.5 top-1.5">
          <ModerationStatusPill status={wallpaper.status} />
        </div>
        {!wallpaper.isPublic && (
          <div className="absolute right-1.5 top-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] text-secondary-text backdrop-blur">
              <EyeIcon className="h-3 w-3" /> private
            </span>
          </div>
        )}
        {pendingAction && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <LoaderIcon className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-sm font-medium text-foreground">
          {wallpaper.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-secondary-text">
          by {wallpaper.creator.username ?? wallpaper.creator.displayName ?? "unknown"}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {wallpaper.category && (
            <Badge variant="outline" className="text-[10px]">
              {wallpaper.category.name}
            </Badge>
          )}
          <span className="text-[10px] tabular-nums text-secondary-text">
            {wallpaper.viewCount.toLocaleString()} views
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <Button
            size="sm"
            variant="default"
            disabled={pendingAction !== null}
            onClick={onApprove}
            className="h-8 px-2"
            aria-label="Approve wallpaper"
          >
            {pendingAction === "approved" ? (
              <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckIcon className="h-3.5 w-3.5" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={pendingAction !== null}
            onClick={onReject}
            className="h-8 px-2"
            aria-label="Reject wallpaper"
          >
            {pendingAction === "rejected" ? (
              <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <AlertIcon className="h-3.5 w-3.5" />
            )}
            Reject
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pendingAction !== null}
            onClick={onFlag}
            className="h-8 px-2"
            aria-label="Flag wallpaper"
          >
            {pendingAction === "flagged" ? (
              <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <AlertIcon className="h-3.5 w-3.5" />
            )}
            Flag
          </Button>
        </div>
      </div>
    </div>
  );
}

function ModerationStatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "border-success/40 bg-success/15 text-success",
    pending: "border-primary/40 bg-primary/15 text-primary",
    rejected: "border-destructive/40 bg-destructive/15 text-destructive",
    flagged: "border-secondary-text/40 bg-secondary-text/15 text-secondary-text",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize backdrop-blur",
        map[status] ?? "border-border bg-background/70 text-secondary-text",
      )}
    >
      {status}
    </span>
  );
}
