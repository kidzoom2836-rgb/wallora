"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type MeResponse = {
  data: { profile: { username: string } | null };
};

/** /profile → the signed-in creator's public profile. */
export default function MyProfileRedirect() {
  const router = useRouter();

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/auth/me");
        if (!res.ok) throw new Error("not signed in");
        const payload = (await res.json()) as MeResponse;
        const username = payload.data?.profile?.username;
        router.replace(username ? `/profile/${username}` : "/settings");
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center gap-2 bg-background text-sm text-secondary-text">
      <Loader2 className="h-4 w-4 animate-spin" />
      Opening your profile…
    </main>
  );
}
