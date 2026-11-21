import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/wallora/empty-state";
import { Users } from "lucide-react";

export default function CommunityPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Community</h1>
      <Tabs defaultValue="feed">
        <TabsList>
          <TabsTrigger value="feed">Feed</TabsTrigger>
          <TabsTrigger value="challenges">Challenges</TabsTrigger>
          <TabsTrigger value="creators">Creators</TabsTrigger>
        </TabsList>
        <TabsContent value="feed" className="mt-4">
          <EmptyState icon={Users} title="No posts yet" description="Community posts will appear here." />
        </TabsContent>
        <TabsContent value="challenges" className="mt-4">
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Challenges will appear here.</CardContent></Card>
        </TabsContent>
        <TabsContent value="creators" className="mt-4">
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Creators will appear here.</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}