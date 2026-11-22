"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Loader2, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useVerificationGate } from "@/components/verification/verification-gate";
import { useAuthDialog } from "@/stores/auth-dialog";
import { cn } from "@/lib/utils";

/**
 * FollowButton
 *
 * Small pill toggle that flips the current user's follow relationship with
 * the target user. Designed to sit in the wallpaper detail dialog next to the
 * creator chip.
 *
 *   - Auth-aware: signed-out visitors are routed to the auth dialog.
 *   - Optimistic state: the label flips immediately; reverts on error.
 *   - Idempotent: server endpoints tolerate duplicate POST/DELETE.
 */

type FollowButtonProps = {
  username: string;
  initialFollowing: boolean;
  /** Hide the button entirely when the viewer is the target user. */
  isSelf?: boolean;
  size?: "sm" | "default";
  className?: string;
};

export function FollowButton({
  username,
  initialFollowing,
  isSelf = false,
  size = "sm",
  className,
}: FollowButtonProps) {
  const { data: session } = useSession();
  const authenticated = !!session?.user;
  const openSignIn = useAuthDialog((s) => s.openSignIn);
  const { guard } = useVerificationGate();

  const [following, setFollowing] = React.useState(initialFollowing);

  React.useEffect(() => {
    setFollowing(initialFollowing);
  }, [initialFollowing, username]);

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const method = following ? "DELETE" : "POST";
      const res = await fetch(`/api/v1/users/${username}/follow`, { method });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        const message = payload?.error?.message ?? "Could not update follow status.";
        throw new Error(message);
      }
      return res.json() as Promise<{ data: { following: boolean } }>;
    },
    onMutate: () => {
      // Optimistic flip.
      setFollowing((prev) => !prev);
    },
    onError: (err: unknown) => {
      // Revert.
      setFollowing(initialFollowing);
      const message = err instanceof Error ? err.message : "Could not update follow status.";
      toast.error("Follow failed", { description: message });
    },
    onSuccess: (response) => {
      // Trust the server as the source of truth.
      setFollowing(response.data.following);
    },
  });

  if (isSelf) return null;

  const handleClick = () => {
    if (!authenticated) {
      openSignIn();
      return;
    }
    guard(() => toggleMutation.mutate(), { action: "follow creators" });
  };

  return (
    <Button
      type="button"
      size={size}
      onClick={handleClick}
      disabled={toggleMutation.isPending}
      aria-pressed={following}
      aria-label={following ? `Unfollow @${username}` : `Follow @${username}`}
      className={cn(
        "rounded-full font-medium transition-colors",
        following
          ? "border border-border bg-surface text-foreground hover:bg-raised"
          : "bg-primary text-primary-foreground hover:bg-primary/90",
        className,
      )}
      variant={following ? "outline" : "default"}
    >
      {toggleMutation.isPending ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : following ? (
        <UserCheck className="mr-1.5 h-3.5 w-3.5" />
      ) : (
        <UserPlus className="mr-1.5 h-3.5 w-3.5" />
      )}
      {following ? "Following" : "Follow"}
    </Button>
  );
}
