"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Users as UsersIcon,
  Image as ImageIcon,
  MessageSquare,
  Sparkles,
  MessageCircle,
  ShoppingBag,
  ShoppingCart,
  Mail,
  Loader2,
  Shield,
  CheckCircle2,
  XCircle,
  Flag,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CalendarDays,
  Eye,
  ThumbsUp,
  Download,
  Lock,
  LayoutDashboard,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WalloraLogo } from "@/components/brand/wallora-logo";
import { useAdminPanel } from "@/stores/admin";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
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

// ---------------------------------------------------------------------------
// Role helper
// ---------------------------------------------------------------------------

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

function isAdminRole(role?: string) {
  return !!role && ADMIN_ROLES.has(role);
}

// Higher-level moderation role set used for read access on stats/users/wallpapers
const MOD_ROLES = new Set(["moderator", "admin", "super_admin"]);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdminPanel() {
  const { open, setOpen } = useAdminPanel();
  const { data: session, status } = useSession();
  const [tab, setTab] = React.useState<TabId>("overview");

  // Block rendering for non-admin sessions even if the store says open.
  const role = session?.user?.role;
  const canRead = status === "authenticated" && MOD_ROLES.has(role ?? "");
  const canModerate = status === "authenticated" && isAdminRole(role);

  // Lock body scroll while open.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex flex-col bg-background/97 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="WALLORA Admin Dashboard"
        >
          {/* Header */}
          <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <WalloraLogo spark />
              <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
                    Admin Dashboard
                  </h1>
                  <Badge
                    variant="outline"
                    className="border-primary/30 bg-primary/10 text-[10px] font-medium text-primary"
                  >
                    Phase 12
                  </Badge>
                </div>
                <p className="text-[11px] text-secondary-text">
                  Internal moderation &amp; platform metrics
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canRead && (
                <Badge
                  variant="outline"
                  className="hidden border-border bg-surface text-[10px] capitalize text-secondary-text sm:inline-flex"
                >
                  <Shield className="mr-1 h-2.5 w-2.5" />
                  {role}
                </Badge>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9"
                onClick={() => setOpen(false)}
                aria-label="Close admin dashboard"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* Tab navigation */}
          <nav
            className="flex items-center gap-1 overflow-x-auto border-b border-border px-4 py-2 sm:px-6"
            aria-label="Admin sections"
          >
            <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
              <LayoutDashboard className="h-3.5 w-3.5" />
              Overview
            </TabButton>
            <TabButton active={tab === "users"} onClick={() => setTab("users")}>
              <UsersIcon className="h-3.5 w-3.5" />
              Users
            </TabButton>
            <TabButton active={tab === "moderation"} onClick={() => setTab("moderation")}>
              <Shield className="h-3.5 w-3.5" />
              Moderation
              <PendingBadge />
            </TabButton>
          </nav>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8"
              >
                {!canRead ? (
                  <AccessDenied />
                ) : tab === "overview" ? (
                  <OverviewTab />
                ) : tab === "users" ? (
                  <UsersTab />
                ) : (
                  <ModerationTab canModerate={canModerate} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Shared tab pieces
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
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors",
        active
          ? "bg-raised text-foreground"
          : "text-secondary-text hover:bg-surface hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function PendingBadge() {
  const { data } = useQuery<{ data: Stats }>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch("/api/v1/admin/stats");
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
    placeholderData: keepPreviousData,
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
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <Lock className="h-8 w-8" />
      </span>
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">Access denied</h2>
        <p className="mt-1 max-w-sm text-sm text-secondary-text">
          The admin dashboard is only visible to admin and super_admin accounts.
          Your current session does not have the required role.
        </p>
      </div>
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

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <XCircle className="h-6 w-6" />
        </span>
        <p className="text-sm text-secondary-text">Failed to load metrics. Try again.</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return <StatsSkeleton />;
  }

  const s = data.data;

  const cards: Array<{
    label: string;
    value: number;
    icon: React.ReactNode;
    hint?: string;
  }> = [
    { label: "Total users", value: s.totalUsers, icon: <UsersIcon className="h-4 w-4" />, hint: `+${s.todayNewUsers} today` },
    { label: "Wallpapers", value: s.totalWallpapers, icon: <ImageIcon className="h-4 w-4" />, hint: `+${s.todayNewWallpapers} today` },
    { label: "Pending review", value: s.pendingWallpapers, icon: <Clock className="h-4 w-4" /> },
    { label: "AI conversations", value: s.totalConversations, icon: <MessageSquare className="h-4 w-4" /> },
    { label: "AI messages", value: s.totalMessages, icon: <MessageCircle className="h-4 w-4" /> },
    { label: "AI generations", value: s.totalGenerations, icon: <Sparkles className="h-4 w-4" /> },
    { label: "Comments", value: s.totalComments, icon: <MessageCircle className="h-4 w-4" /> },
    { label: "Products", value: s.totalProducts, icon: <ShoppingBag className="h-4 w-4" /> },
    { label: "Purchases", value: s.totalPurchases, icon: <ShoppingCart className="h-4 w-4" /> },
    { label: "Waitlist entries", value: s.totalWaitlistEntries, icon: <Mail className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Top KPI row */}
      <section>
        <SectionHeading
          title="Platform metrics"
          subtitle="Real-time counts from the WALLORA database."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((c) => (
            <StatCard key={c.label} {...c} />
          ))}
        </div>
      </section>

      {/* Today usage + status breakdown */}
      <section className="grid gap-4 md:grid-cols-3">
        <UsageCard credits={s.todayAiUsage} newUsers={s.todayNewUsers} newWallpapers={s.todayNewWallpapers} />
        <StatusBreakdownCard data={s.wallpapersByStatus} />
        <TopCategoriesCard categories={s.topCategories} />
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/20">
      <div className="flex items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        {hint && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success">
            <TrendingUp className="h-3 w-3" />
            {hint.replace("+0 today", "—")}
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-2xl font-semibold tabular-nums text-foreground">
        {value.toLocaleString()}
      </p>
      <p className="mt-0.5 text-xs text-secondary-text">{label}</p>
    </div>
  );
}

function UsageCard({
  credits,
  newUsers,
  newWallpapers,
}: {
  credits: number;
  newUsers: number;
  newWallpapers: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold text-foreground">Today</h3>
      </div>
      <dl className="mt-4 space-y-3">
        <Row label="AI credits used" value={`${credits.toLocaleString()}`} />
        <Row label="New users" value={`${newUsers.toLocaleString()}`} />
        <Row label="New wallpapers" value={`${newWallpapers.toLocaleString()}`} />
      </dl>
    </div>
  );
}

function StatusBreakdownCard({
  data,
}: {
  data: { approved: number; pending: number; rejected: number; flagged: number };
}) {
  const rows: Array<{ key: string; label: string; value: number; color: string }> = [
    { key: "approved", label: "Approved", value: data.approved, color: "bg-success" },
    { key: "pending", label: "Pending", value: data.pending, color: "bg-primary" },
    { key: "rejected", label: "Rejected", value: data.rejected, color: "bg-destructive" },
    { key: "flagged", label: "Flagged", value: data.flagged, color: "bg-secondary-text" },
  ];
  const total = rows.reduce((acc, r) => acc + r.value, 0) || 1;
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold text-foreground">Wallpaper status</h3>
      </div>
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-raised">
        {rows.map((r) =>
          r.value > 0 ? (
            <div
              key={r.key}
              className={cn("h-full", r.color)}
              style={{ width: `${(r.value / total) * 100}%` }}
              title={`${r.label}: ${r.value}`}
            />
          ) : null,
        )}
      </div>
      <dl className="mt-4 space-y-2.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between text-xs">
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
  categories: Array<{
    id: string;
    slug: string;
    name: string;
    icon: string | null;
    wallpaperCount: number;
  }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold text-foreground">Top categories</h3>
      </div>
      {categories.length === 0 ? (
        <p className="mt-4 text-xs text-secondary-text">No categories yet.</p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {categories.map((c, i) => (
            <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-raised text-[10px] font-semibold text-secondary-text">
                  {i + 1}
                </span>
                <span className="truncate font-medium text-foreground">{c.name}</span>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <dt className="text-secondary-text">{label}</dt>
      <dd className="tabular-nums font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-base font-semibold text-foreground">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-secondary-text">{subtitle}</p>}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-surface" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl border border-border bg-surface" />
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
    data: { items: AdminUser[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
  }>({
    queryKey: ["admin-users", page],
    queryFn: async () => {
      const res = await fetch(`/api/v1/admin/users?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const items = data?.data.items ?? [];
  const pagination = data?.data.pagination;

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <XCircle className="h-6 w-6" />
        </span>
        <p className="text-sm text-secondary-text">Failed to load users.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Users"
        subtitle={`Showing ${items.length} of ${pagination?.total.toLocaleString() ?? 0} users.`}
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-7 w-7" />}
          title="No users found"
          subtitle="The user table is empty."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-raised/60 text-[11px] uppercase tracking-wider text-secondary-text">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Wallpapers</th>
                  <th className="px-4 py-3 text-right font-medium">Conversations</th>
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

          {/* Mobile list */}
          <ul className="space-y-2 md:hidden">
            {items.map((u) => (
              <li key={u.id} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {u.profile?.displayName || u.profile?.username || u.name || "Unnamed"}
                    </p>
                    <p className="truncate text-xs text-secondary-text">{u.email}</p>
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

          {pagination && pagination.totalPages > 1 && (
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
  return (
    <tr className="transition-colors hover:bg-raised/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
            {(user.profile?.username?.[0] ?? user.email?.[0] ?? "?").toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-foreground">
                {user.profile?.displayName || user.profile?.username || user.name || "Unnamed"}
              </span>
              {user.profile?.verified && (
                <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" aria-label="Verified" />
              )}
            </div>
            <p className="truncate text-xs text-secondary-text">{user.email}</p>
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
  const map: Record<string, string> = {
    super_admin: "border-primary/40 bg-primary/10 text-primary",
    admin: "border-primary/30 bg-primary/10 text-primary",
    moderator: "border-chart-3/30 bg-chart-3/10 text-chart-3",
    creator: "border-success/30 bg-success/10 text-success",
    user: "border-border bg-surface text-secondary-text",
    guest: "border-border bg-surface text-secondary-text",
  };
  return (
    <Badge
      variant="outline"
      className={cn(
        "border text-[10px] font-medium capitalize",
        map[role] ?? map.user,
      )}
    >
      {role}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "border-success/30 bg-success/10 text-success",
    suspended: "border-destructive/30 bg-destructive/10 text-destructive",
    deleted: "border-border bg-surface text-secondary-text",
  };
  return (
    <Badge
      variant="outline"
      className={cn(
        "border text-[10px] font-medium capitalize",
        map[status] ?? map.active,
      )}
    >
      {status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Moderation tab
// ---------------------------------------------------------------------------

const MOD_STATUS_OPTIONS = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "flagged", label: "Flagged" },
] as const;

function ModerationTab({ canModerate }: { canModerate: boolean }) {
  const [status, setStatus] = React.useState<string>("pending");
  const [page, setPage] = React.useState(1);
  const limit = 24;
  const queryClient = useQueryClient();

  // Reset to page 1 when filter changes.
  React.useEffect(() => {
    setPage(1);
  }, [status]);

  const { data, isLoading, isError } = useQuery<{
    data: {
      items: AdminWallpaper[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    };
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
    mutationFn: async ({ id, nextStatus }: { id: string; nextStatus: string }) => {
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
    },
    onError: (err: Error) => {
      toast.error("Moderation failed", { description: err.message });
    },
  });

  const items = data?.data.items ?? [];
  const pagination = data?.data.pagination;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeading
          title="Moderation queue"
          subtitle="Review and act on wallpaper submissions."
        />
        <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
          {MOD_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
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

      {!canModerate && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-xs text-secondary-text">
          <Lock className="h-3.5 w-3.5" />
          You have read access only. Approve and reject actions require an admin role.
        </div>
      )}

      {isError ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <XCircle className="h-6 w-6" />
          </span>
          <p className="text-sm text-secondary-text">Failed to load wallpapers.</p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-7 w-7" />}
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
                canModerate={canModerate}
                pendingAction={moderateMutation.isPending}
                onApprove={() => moderateMutation.mutate({ id: w.id, nextStatus: "approved" })}
                onReject={() => moderateMutation.mutate({ id: w.id, nextStatus: "rejected" })}
                onFlag={() => moderateMutation.mutate({ id: w.id, nextStatus: "flagged" })}
              />
            ))}
          </div>
          {pagination && pagination.totalPages > 1 && (
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
  canModerate,
  pendingAction,
  onApprove,
  onReject,
  onFlag,
}: {
  wallpaper: AdminWallpaper;
  canModerate: boolean;
  pendingAction: boolean;
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface"
    >
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
              <Lock className="h-2.5 w-2.5" /> private
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-sm font-medium text-foreground">{wallpaper.title}</p>
        <p className="mt-0.5 truncate text-[11px] text-secondary-text">
          {wallpaper.creator.displayName ||
            wallpaper.creator.username ||
            wallpaper.creator.email}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-secondary-text">
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3 w-3" /> {wallpaper.viewCount.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" /> {wallpaper.likeCount.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <Download className="h-3 w-3" /> {wallpaper.downloadCount.toLocaleString()}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {wallpaper.category && (
            <Badge variant="outline" className="border-border bg-raised text-[9px] text-secondary-text">
              {wallpaper.category.name}
            </Badge>
          )}
          <Badge variant="outline" className="border-border bg-raised text-[9px] capitalize text-secondary-text">
            {wallpaper.sourceType}
          </Badge>
          <Badge variant="outline" className="border-border bg-raised text-[9px] text-secondary-text">
            {wallpaper.license}
          </Badge>
        </div>

        {canModerate && (
          <div className="mt-3 flex items-center gap-1.5">
            <Button
              size="sm"
              className="h-7 flex-1 bg-success text-success-foreground hover:bg-success/90"
              onClick={onApprove}
              disabled={pendingAction}
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-border text-secondary-text hover:text-foreground"
              onClick={onFlag}
              disabled={pendingAction}
              aria-label="Flag wallpaper"
            >
              <Flag className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={onReject}
              disabled={pendingAction}
              aria-label="Reject wallpaper"
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {pendingAction && (
          <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-secondary-text">
            <Loader2 className="h-3 w-3 animate-spin" /> applying…
          </p>
        )}
      </div>
    </motion.div>
  );
}

function ModerationStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: "Approved", cls: "border-success/30 bg-success/20 text-success" },
    pending: { label: "Pending", cls: "border-primary/30 bg-primary/20 text-primary" },
    rejected: { label: "Rejected", cls: "border-destructive/30 bg-destructive/20 text-destructive" },
    flagged: { label: "Flagged", cls: "border-secondary-text/40 bg-secondary-text/20 text-secondary-text" },
  };
  const entry = map[status] ?? { label: status, cls: "border-border bg-background/80 text-secondary-text" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur",
        entry.cls,
      )}
    >
      {entry.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      <p className="text-xs text-secondary-text">
        Page <span className="tabular-nums text-foreground">{page}</span> of{" "}
        <span className="tabular-nums text-foreground">{totalPages}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-border text-secondary-text hover:text-foreground"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-border text-secondary-text hover:text-foreground"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-secondary-text">
        {icon}
      </span>
      <div>
        <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-secondary-text">{subtitle}</p>}
      </div>
    </div>
  );
}
