"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Profile { id: string; userId: string; username: string; displayName: string | null; bio: string | null; avatarUrl: string | null; }

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/profiles/${username}`).then((r) => r.json()).then((d) => { setProfile(d.profile ?? null); setLoading(false); });
  }, [username]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!profile) return <p className="text-sm text-muted-foreground">Profile not found.</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <Avatar className="h-16 w-16">
            <AvatarFallback>{(profile.username ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-semibold">{profile.displayName ?? profile.username}</h1>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
