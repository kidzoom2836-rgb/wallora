import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Project #{id}</h1>
        <Button variant="outline">Rename</Button>
      </div>
      <Tabs defaultValue="assets">
        <TabsList>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
        <TabsContent value="assets" className="mt-4">
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Project assets arrive in Phase 7.</CardContent></Card>
        </TabsContent>
        <TabsContent value="conversations" className="mt-4">
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Linked conversations arrive in Phase 7.</CardContent></Card>
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Notes arrive in Phase 7.</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}