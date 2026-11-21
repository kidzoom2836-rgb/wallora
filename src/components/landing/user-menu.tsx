"use client";

import { signOut } from "next-auth/react";
import {
  LogOut,
  User as UserIcon,
  Settings,
  Shield,
  ChevronDown,
  FolderKanban,
  LayoutDashboard,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useProjects } from "@/stores/projects";
import { useAdminPanel } from "@/stores/admin";
import { cn } from "@/lib/utils";

type UserMenuProps = {
  user: {
    name?: string | null;
    username?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  };
};

function initials(name?: string | null) {
  if (!name) return "W";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "W";
}

export function UserMenu({ user }: UserMenuProps) {
  const role = user.role ?? "user";
  const isAdmin = role === "admin" || role === "super_admin";
  const openProjects = useProjects((s) => s.openPanel);
  const openAdmin = useAdminPanel((s) => s.openAdmin);

  const handleSignOut = async () => {
    toast.info("Signing out…");
    await signOut({ redirect: false });
    toast.success("Signed out", {
      description: "See you soon.",
    });
  };

  const comingSoon = (feature: string) => () => {
    toast.info(`${feature} opens in a later phase`, {
      description: "Your account is ready — the dashboard ships in the next phase.",
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 rounded-full border border-border bg-surface/60 pl-1.5 pr-2 hover:bg-surface"
          aria-label="User menu"
        >
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary",
            )}
          >
            {user.image ? (
              <img
                src={user.image}
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              initials(user.name)
            )}
          </span>
          <span className="hidden max-w-[100px] truncate text-xs font-medium text-foreground sm:inline">
            {user.username || user.name || "Account"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-secondary-text" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-60 border-border bg-popover"
        sideOffset={8}
      >
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-foreground">
            {user.name || "WALLORA member"}
          </span>
          <span className="truncate text-xs text-secondary-text">
            {user.email}
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="border-border bg-surface text-[10px] capitalize text-secondary-text"
            >
              <Shield className="mr-1 h-2.5 w-2.5" />
              {role}
            </Badge>
            <Badge variant="outline" className="border-success/30 bg-success/10 text-[10px] text-success">
              Active
            </Badge>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem onClick={openProjects} className="text-secondary-text focus:text-foreground cursor-pointer">
          <FolderKanban className="mr-2 h-4 w-4" />
          My Projects
        </DropdownMenuItem>
        <DropdownMenuItem onClick={comingSoon("Your profile")} className="text-secondary-text focus:text-foreground cursor-pointer">
          <UserIcon className="mr-2 h-4 w-4" />
          Your profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={comingSoon("Settings")} className="text-secondary-text focus:text-foreground cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem onClick={openAdmin} className="text-primary focus:text-primary cursor-pointer">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Admin Dashboard
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-destructive focus:text-destructive cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
