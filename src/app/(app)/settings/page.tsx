"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BadgeCheck,
  Bell,
  Camera,
  Crown,
  Image as ImageIcon,
  Loader2,
  LockKeyhole,
  Mail,
  Palette,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  LogOut,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VerifiedTick } from "@/components/brand/verified-badge";
import { TIER_LIMITS, TIER_PERKS, type VerificationTier } from "@/lib/verification/tiers";
import { cn } from "@/lib/utils";

type Me = {
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  status: string;
  createdAt: string;
  verificationTier: VerificationTier;
  profile: {
    username: string;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    coverUrl: string | null;
    verified: boolean;
    creatorStatus: string;
  } | null;
};

type AppSettings = {
  theme: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  aiPreferenceMode: string;
  preferredImageStyles: string;
  preferredCategories: string;
};

const SECTIONS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "verification", label: "Verification", icon: BadgeCheck },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "ai", label: "AI preferences", icon: Sparkles },
  { id: "account", label: "Account", icon: LockKeyhole },
] as const;

export default function SettingsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { setTheme } = useTheme();
  const [active, setActive] = React.useState<string>("profile");
  const [displayName, setDisplayName] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [formSettings, setFormSettings] = React.useState<AppSettings>({
    theme: "dark",
    emailNotifications: true,
    pushNotifications: false,
    aiPreferenceMode: "creative-assistant",
    preferredImageStyles: "",
    preferredCategories: "",
  });
  const [uploading, setUploading] = React.useState<"avatar" | "cover" | null>(null);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const meQuery = useQuery<{ data: Me }>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/v1/auth/me");
      if (!res.ok) throw new Error("Could not load your account");
      return res.json();
    },
  });

  const settingsQuery = useQuery<{ data: AppSettings }>({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/v1/settings");
      if (!res.ok) throw new Error("Could not load settings");
      return res.json();
    },
  });

  React.useEffect(() => {
    const me = meQuery.data?.data;
    if (me?.profile) {
      setDisplayName(me.profile.displayName ?? "");
      setBio(me.profile.bio ?? "");
    }
  }, [meQuery.data]);

  React.useEffect(() => {
    const settings = settingsQuery.data?.data;
    if (!settings) return;
    setFormSettings(settings);
    if (settings.theme === "dark" || settings.theme === "light" || settings.theme === "system") {
      setTheme(settings.theme);
    }
  }, [settingsQuery.data, setTheme]);

  React.useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash && SECTIONS.some((s) => s.id === hash)) setActive(hash);
  }, []);

  const me = meQuery.data?.data;
  const tier = me?.verificationTier ?? "free";

  const uploadMedia = async (kind: "avatar" | "cover", file: File) => {
    setUploading(kind);
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("file", file);
      const res = await fetch("/api/v1/profile/media", { method: "POST", body: form });
      const payload = (await res.json()) as {
        data?: { url: string };
        error?: { message?: string };
      };
      if (!res.ok) throw new Error(payload.error?.message ?? "Upload failed");
      toast.success(kind === "avatar" ? "Profile photo updated" : "Cover updated");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["auth", "me"] }),
        qc.invalidateQueries({ queryKey: ["public-profile"] }),
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/v1/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, bio }),
      });
      const payload = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(payload.error?.message ?? "Could not save profile");
      toast.success("Profile saved");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["auth", "me"] }),
        qc.invalidateQueries({ queryKey: ["public-profile"] }),
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/v1/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formSettings),
      });
      const payload = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(payload.error?.message ?? "Could not save settings");
      setTheme(formSettings.theme);
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/v1/account", { method: "DELETE" });
      const payload = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(payload.error?.message ?? "Could not delete account");
      toast.success("Your account has been deleted");
      await signOut({ redirect: false });
      router.push("/");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete account");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (meQuery.isLoading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </main>
    );
  }

  if (meQuery.isError || !me) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-foreground">Sign in to manage settings</h1>
        <Link href="/login" className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Account</p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">Settings</h1>
            <p className="mt-1 text-sm text-secondary-text">
              Manage your identity, verification, preferences and account.
            </p>
          </div>
          {me.profile?.username && (
            <Link
              href={`/profile/${me.profile.username}`}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground hover:bg-raised"
            >
              <UserRound className="h-4 w-4" />
              View public profile
            </Link>
          )}
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* Section navigation */}
          <nav className="lg:sticky lg:top-24 lg:self-start" aria-label="Settings sections">
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1.5 lg:flex-col lg:overflow-visible">
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setActive(id);
                    window.history.replaceState(null, "", `#${id}`);
                  }}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                    active === id
                      ? "bg-primary/10 text-primary"
                      : "text-secondary-text hover:bg-raised hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </nav>

          <div className="flex flex-col gap-6">
            {/* PROFILE */}
            <section id="profile" className={cn("settings-card", active !== "profile" && "hidden lg:block")}>
              <SectionHeader icon={UserRound} title="Profile" subtitle="How you appear across WALLORA." />
              <div className="mt-6 space-y-6">
                <div className="grid gap-6 sm:grid-cols-[160px_1fr]">
                  <div>
                    <p className="text-xs font-medium text-secondary-text">Profile photo</p>
                    <div className="relative mt-2 h-32 w-32 overflow-hidden rounded-2xl border border-border bg-raised">
                      {me.profile?.avatarUrl ? (
                        <img src={me.profile.avatarUrl} alt="Your profile" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-primary/15 text-3xl font-semibold text-primary">
                          {(me.profile?.displayName ?? me.email)[0]?.toUpperCase()}
                        </div>
                      )}
                      {uploading === "avatar" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      )}
                    </div>
                    <MediaPicker label="Change photo" accept="image/*" onFile={(f) => uploadMedia("avatar", f)} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-secondary-text">Profile cover</p>
                    <div className="relative mt-2 h-28 w-full overflow-hidden rounded-xl border border-border bg-raised">
                      {me.profile?.coverUrl ? (
                        <img src={me.profile.coverUrl} alt="Your cover" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,rgba(122,92,255,0.25),transparent_60%)]" />
                      )}
                      {uploading === "cover" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      )}
                    </div>
                    <MediaPicker label="Change cover" accept="image/*" onFile={(f) => uploadMedia("cover", f)} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display name</Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={60}
                      className="border-border bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input value={`@${me.profile?.username ?? ""}`} disabled className="border-border bg-raised" />
                    <p className="text-[11px] text-secondary-text">Your permanent WALLORA handle.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={500}
                    rows={4}
                    placeholder="Tell the community what you create…"
                    className="border-border bg-background"
                  />
                  <p className="text-right text-[11px] text-secondary-text">{bio.length}/500</p>
                </div>

                <div className="flex justify-end">
                  <Button onClick={saveProfile} disabled={savingProfile} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save profile
                  </Button>
                </div>
              </div>
            </section>

            {/* VERIFICATION */}
            <section id="verification" className={cn("settings-card", active !== "verification" && "hidden lg:block")}>
              <SectionHeader icon={ShieldCheck} title="Verification & limits" subtitle="Every account starts with the free grey tick." />
              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/25 bg-primary/5 p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
                      <VerifiedTick tier={tier} className="size-6" />
                    </span>
                    <div>
                      <p className="font-medium capitalize text-foreground">
                        {tier === "free" ? "Free verified" : `${tier} verified`}
                      </p>
                      <p className="text-xs text-secondary-text">
                        {tier === "free"
                          ? "Apply for blue, gold or supreme to raise your limits."
                          : "Your higher-tier badge is active across WALLORA."}
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="outline" className="border-primary/30 bg-background text-primary hover:bg-primary/10">
                    <Link href="/verification">{tier === "free" ? "Upgrade badge" : "Manage application"}</Link>
                  </Button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {(["free", "verified", "premium", "supreme"] as VerificationTier[]).map((t) => (
                    <div
                      key={t}
                      className={cn(
                        "rounded-xl border p-4",
                        t === tier ? "border-primary bg-primary/5" : "border-border bg-background",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <VerifiedTick tier={t} className="size-4" />
                        <p className="text-sm font-medium capitalize text-foreground">{t}</p>
                      </div>
                      <p className="mt-2 text-xs text-secondary-text">
                        {TIER_LIMITS[t].dailyCredits} AI credits/day
                      </p>
                      <p className="text-xs text-secondary-text">
                        {TIER_LIMITS[t].postsPerDay} posts/day
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {TIER_PERKS[t].map((perk) => (
                          <li key={perk} className="text-[11px] text-secondary-text">• {perk}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* NOTIFICATIONS */}
            <section id="notifications" className={cn("settings-card", active !== "notifications" && "hidden lg:block")}>
              <SectionHeader icon={Bell} title="Notifications" subtitle="Choose what WALLORA can send you." />
              <div className="mt-6 divide-y divide-border">
                <ToggleRow
                  title="Email notifications"
                  description="Product updates and account activity."
                  checked={formSettings.emailNotifications}
                  onChange={(v) => setFormSettings((s) => ({ ...s, emailNotifications: v }))}
                />
                <ToggleRow
                  title="Push notifications"
                  description="Replies, follows and project shoutouts."
                  checked={formSettings.pushNotifications}
                  onChange={(v) => setFormSettings((s) => ({ ...s, pushNotifications: v }))}
                />
              </div>
              <div className="mt-5 flex justify-end">
                <Button onClick={saveSettings} disabled={savingSettings} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {savingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save notifications
                </Button>
              </div>
            </section>

            {/* APPEARANCE */}
            <section id="appearance" className={cn("settings-card", active !== "appearance" && "hidden lg:block")}>
              <SectionHeader icon={Palette} title="Appearance" subtitle="Choose how WALLORA looks on this device." />
              <div className="mt-6 max-w-sm space-y-3">
                <Label>Theme</Label>
                <Select
                  value={formSettings.theme}
                  onValueChange={(v) => {
                    setFormSettings((s) => ({ ...s, theme: v }));
                    setTheme(v);
                  }}
                >
                  <SelectTrigger className="border-border bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover">
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-secondary-text">
                  Dark is the signature WALLORA look. Light and System are also available. Save to keep this choice.
                </p>
                <div className="flex justify-end pt-1">
                  <Button onClick={saveSettings} disabled={savingSettings} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    {savingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save appearance
                  </Button>
                </div>
              </div>
            </section>

            {/* AI PREFERENCES */}
            <section id="ai" className={cn("settings-card", active !== "ai" && "hidden lg:block")}>
              <SectionHeader icon={Sparkles} title="AI preferences" subtitle="Shape how the WALLORA assistant works with you." />
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Assistant mode</Label>
                  <Select
                    value={formSettings.aiPreferenceMode}
                    onValueChange={(v) => setFormSettings((s) => ({ ...s, aiPreferenceMode: v }))}
                  >
                    <SelectTrigger className="border-border bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-popover">
                      <SelectItem value="creative-assistant">Creative assistant</SelectItem>
                      <SelectItem value="precise">Precise</SelectItem>
                      <SelectItem value="concise">Concise</SelectItem>
                      <SelectItem value="collaborative">Collaborative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="styles">Preferred image styles</Label>
                  <Input
                    id="styles"
                    value={formSettings.preferredImageStyles}
                    onChange={(e) => setFormSettings((s) => ({ ...s, preferredImageStyles: e.target.value }))}
                    placeholder="cinematic, minimal, neon…"
                    className="border-border bg-background"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="categories">Preferred categories</Label>
                  <Input
                    id="categories"
                    value={formSettings.preferredCategories}
                    onChange={(e) => setFormSettings((s) => ({ ...s, preferredCategories: e.target.value }))}
                    placeholder="nature, abstract, gaming…"
                    className="border-border bg-background"
                  />
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <Button onClick={saveSettings} disabled={savingSettings} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {savingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save AI preferences
                </Button>
              </div>
            </section>

            {/* ACCOUNT */}
            <section id="account" className={cn("settings-card", active !== "account" && "hidden lg:block")}>
              <SectionHeader icon={LockKeyhole} title="Account" subtitle="Your sign-in and account status." />
              <div className="mt-6 divide-y divide-border">
                <InfoRow icon={Mail} label="Email" value={me.email} />
                <InfoRow icon={Settings2} label="Role" value={<Badge variant="outline" className="border-border bg-surface capitalize">{me.role}</Badge>} />
                <InfoRow icon={ShieldCheck} label="Status" value={<Badge variant="outline" className="border-success/30 bg-success/10 capitalize text-success">{me.status}</Badge>} />
                <InfoRow icon={Crown} label="Verification" value={<span className="capitalize">{tier}</span>} />
              </div>
              <div className="mt-6 space-y-3">
                <Button
                  variant="outline"
                  className="w-full border-border bg-surface text-foreground hover:bg-raised"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>

                {!confirmDelete ? (
                  <Button
                    variant="outline"
                    className="w-full border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete account
                  </Button>
                ) : (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
                    <p className="flex items-start gap-2 text-sm text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      This permanently disables your account. Your public wallpapers stay in the
                      library, but your profile and sign-in are removed. This cannot be undone.
                    </p>
                    <div className="mt-4 flex gap-2">
                      <Button
                        className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={handleDeleteAccount}
                        disabled={deleting}
                      >
                        {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        {deleting ? "Deleting…" : "Yes, delete my account"}
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-secondary-text hover:text-foreground"
                        onClick={() => setConfirmDelete(false)}
                        disabled={deleting}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof UserRound;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border pb-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-secondary-text">{subtitle}</p>
      </div>
    </div>
  );
}

function MediaPicker({
  label,
  accept,
  onFile,
}: {
  label: string;
  accept: string;
  onFile: (file: File) => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <Camera className="h-3.5 w-3.5" />
        {label}
      </button>
    </>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-secondary-text">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 text-sm">
      <span className="flex items-center gap-2 text-secondary-text">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
