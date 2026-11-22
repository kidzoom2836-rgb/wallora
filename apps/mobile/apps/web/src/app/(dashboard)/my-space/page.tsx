import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/wallora/empty-state";
import { Heart } from "lucide-react";

export default function MySpacePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">My Space</h1>
      <Tabs defaultValue="saved">
        <TabsList>
          <TabsTrigger value="saved">Saved</TabsTrigger>
          <TabsTrigger value="generated">Generated</TabsTrigger>
          <TabsTrigger value="downloads">Downloads</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        {["saved", "generated", "downloads", "activity"].map((t) => (
          <TabsContent key={t} value={t} className="mt-4">
            <EmptyState icon={Heart} title="Nothing here yet" description="Your personal library will appear here." />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}