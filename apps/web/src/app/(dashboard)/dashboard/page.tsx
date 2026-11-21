"use client";

import { ImageCard } from "@/components/wallora/image-card";
import { CardSkeleton } from "@/components/wallora/loading-skeleton";
import { EmptyState } from "@/components/wallora/empty-state";
import { Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function DashboardPage() {
  const { data: session } = authClient.useSession();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          Welcome back{session?.user?.name ? `, ${session.user.name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">Here&apos;s your creative space.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 md:p-6">
        <p className="text-sm font-medium">What do you want to create?</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="A futuristic luxury bedroom with golden lighting…"
            className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none ring-primary/40 focus:ring-2"
          />
          <Button nativeButton={false} render={<Link href="/ai" />}>Ask AI</Button>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Continue recent projects</h2>
          <Link href="/projects" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-card/40 p-4 text-sm text-muted-foreground">
            + New project
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recommended artwork</h2>
          <Link href="/discover" className="text-sm text-primary hover:underline">Discover</Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <ImageCard key={i} title={`Inspiration ${i}`} creator="creator" src="" />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your saved items</h2>
        <EmptyState icon={Images} title="No saved items yet" description="Save wallpapers and generated images to see them here." />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Loading preview</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
        </div>
      </section>
    </div>
  );
}
