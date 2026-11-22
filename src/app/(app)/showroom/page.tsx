import type { Metadata } from "next";

import { ShowroomGrid } from "@/components/landing/showroom-grid";

export const metadata: Metadata = {
  title: "Showroom",
  description: "Curated WALLORA showrooms built from real wallpapers and public projects.",
};

export default function ShowroomPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <ShowroomGrid />
    </div>
  );
}
