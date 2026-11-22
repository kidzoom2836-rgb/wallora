"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Camera,
  FolderKanban,
  Grid2X2,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Settings,
  UserRound,
} from "lucide-react";

import { VerifiedTick } from "@/components/brand/verified-badge";
import { FollowButton } from "@/components/landing/follow-button";
import { WallpaperCard, type WallpaperSummary } from "@/components/landing/wallpaper-card";
import { WallpaperDetailDialog } from "@/components/landing/wallpaper-detail-dialog";
import { TIER_PERKS, type VerificationTier } from "@/lib/verification/tiers";
import { cn } from "@/lib/utils";

type ProfileData = {
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  verified: boolean;
  tier: VerificationTier;
  creatorStatus: string;
  createdAt: string;
  stats: { followers: number; following: number; wallpapers: number };
  isFollowing: boolean;
  isSelf: boolean;
};

type ProjectItem = {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  owner: { username: string | null; displayName: string | null; tier: VerificationTier };
  _count?: { assets?: number };
};

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params?.username;
  const [tab, setTab] = React.useState<"wallpapers" | "projects">("wallpapers");

  const profileQuery = useQuery<{ data: ProfileData }>({
    queryKey: ["public-profile", username],
    queryFn: async () => {
      const res = await fetch(`/api/v1/users/${username}`);
      if (!res.ok) throw new Error("Profile not found");
      return res.json();
    },
    enabled: !!username,
  });

  const wallpapersQuery = useQuery<{
    data: { items: WallpaperSummary[]; pagination: { total: number } };
  }>({
    queryKey: ["profile-wallpapers", username],
    queryFn: async () => {
      const res = await fetch(`/api/v1/wallpapers?creator=${username}&limit=24`);
      if (!res.ok) throw new Error("Could not load wallpapers");
      return res.json();
    },
    enabled: !!username && tab === "wallpapers",
  });

  const projectsQuery = useQuery<{ data: { items: ProjectItem[] } }>({
    queryKey: ["profile-projects", username],
    queryFn: async () => {
      const res = await fetch("/api/v1/projects/showcase?limit=36");
      if (!res.ok) throw new Error("Could not load projects");
      return res.json();
    },
    enabled: tab === "projects",
  });

  const profile = profileQuery.data?.data;
  const wallpapers = wallpapersQuery.data?.data.items ?? [];
  const projects = (projectsQuery.data?.data.items ?? []).filter(
    (p) => p.owner?.username === username,
  );

  if (profileQuery.isLoading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </main>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-foreground">Creator not found</h1>
        <p className="mt-2 text-sm text-secondary-text">
          This profile does not exist or is no longer active.
        </p>
        <Link href="/discover" className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Browse wallpapers
        </Link>
      </main>
    );
  }

  const displayName = profile.displayName ?? profile.username ?? "WALLORA creator";
  const perks = TIER_PERKS[profile.tier] ?? TIER_PERKS.free;

  return (
    <main className="min-h-screen bg-background pb-20">
      {/* Cover */}
      <div className="relative h-44 w-full overflow-hidden bg-raised sm:h-60">
        {profile.coverUrl ? (
          <img src={profile.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,rgba(122,92,255,0.25),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(48,209,196,0.18),transparent_50%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      <div className="mx-auto -mt-16 max-w-6xl px-4 sm:px-6 lg:px-8">
        <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border-4 border-background bg-surface shadow-xl sm:h-32 sm:w-32">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/15 text-3xl font-semibold text-primary">
                  {displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="absolute bottom-1 right-1 rounded-full border border-border bg-background/90 p-1">
                <VerifiedTick tier={profile.tier} className="size-4" />
              </span>
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-semibold text-foreground">{displayName}</h1>
                <VerifiedTick tier={profile.tier} className="size-4" />
              </div>
              <p className="text-sm text-secondary-text">@{profile.username}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-secondary-text">
                <CalendarDays className="h-3 w-3" />
                Joined {new Date(profile.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pb-1">
            {profile.isSelf ? (
              <>
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-raised"
                >
                  <Settings className="h-4 w-4" />
                  Edit profile
                </Link>
                <Link
                  href="/settings#verification"
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20"
                >
                  <VerifiedTick tier={profile.tier} className="size-4" />
                  {profile.tier === "free" ? "Upgrade verification" : "Verification perks"}
                </Link>
              </>
            ) : (
              <FollowButton
                username={profile.username}
                initialFollowing={profile.isFollowing}
              />
            )}
            <Link
              href="/showroom"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-raised"
            >
              <ImageIcon className="h-4 w-4" />
              Showroom
            </Link>
          </div>
        </section>

        {/* Bio + stats */}
        <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {profile.bio ?? "This creator has not written a bio yet."}
            </p>
            <div className="mt-5 flex flex-wrap gap-5 text-sm">
              <Stat label="Wallpapers" value={profile.stats.wallpapers} />
              <Stat label="Followers" value={profile.stats.followers} />
              <Stat label="Following" value={profile.stats.following} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/community" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-secondary-text hover:text-foreground">
                <MessageCircle className="h-3.5 w-3.5" />
                Community posts
              </Link>
              <Link href={`/showroom/${profile.username}`} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-secondary-text hover:text-foreground">
                <Grid2X2 className="h-3.5 w-3.5" />
                Curated showroom
              </Link>
            </div>
          </div>

          <aside className="rounded-2xl border border-border bg-surface p-5">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-secondary-text">
              <UserRound className="h-3.5 w-3.5 text-primary" />
              Verification
            </p>
            <p className="mt-3 font-display text-lg font-semibold capitalize text-foreground">
              {profile.tier === "free" ? "Free verified" : `${profile.tier} verified`}
            </p>
            <ul className="mt-3 flex flex-col gap-2 text-xs text-secondary-text">
              {perks.map((perk) => (
                <li key={perk} className="flex items-start gap-2">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  {perk}
                </li>
              ))}
            </ul>
            {profile.tier === "free" && (
              <Link href="/verification" className="mt-4 inline-flex text-xs font-medium text-primary hover:underline">
                Apply for a higher badge →
              </Link>
            )}
          </aside>
        </section>

        {/* Tabs */}
        <div className="mt-10 flex items-center gap-2 border-b border-border">
          <TabButton active={tab === "wallpapers"} onClick={() => setTab("wallpapers")} icon={Grid2X2} label="Wallpapers" />
          <TabButton active={tab === "projects"} onClick={() => setTab("projects")} icon={FolderKanban} label="Projects" />
        </div>

        {tab === "wallpapers" ? (
          wallpapersQuery.isLoading ? (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-shimmer rounded-xl border border-border" />
              ))}
            </div>
          ) : wallpapers.length ? (
            <div className="mt-6 columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
              {wallpapers.map((w, i) => (
                <WallpaperCard key={w.id} wallpaper={w} index={i} />
              ))}
            </div>
          ) : (
            <EmptyTab icon={Camera} text="No public wallpapers yet." />
          )
        ) : projectsQuery.isLoading ? (
          <div className="mt-6 h-32 animate-shimmer rounded-xl border border-border" />
        ) : projects.length ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate font-medium text-foreground group-hover:text-primary">{p.title}</h3>
                  <VerifiedTick tier={p.owner?.tier ?? "free"} className="size-4" />
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-secondary-text">
                  {p.description ?? "A WALLORA creative project."}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyTab icon={FolderKanban} text="No public projects yet." />
        )}
      </div>

      <WallpaperDetailDialog />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="text-xs text-secondary-text">{label}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Grid2X2;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-secondary-text hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function EmptyTab({ icon: Icon, text }: { icon: typeof Camera; text: string }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface/50 p-10 text-center">
      <Icon className="h-6 w-6 text-secondary-text" />
      <p className="text-sm text-secondary-text">{text}</p>
    </div>
  );
}
