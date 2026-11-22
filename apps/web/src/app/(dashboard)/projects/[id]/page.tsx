"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Project { id: string; name: string; description: string | null; visibility: string; }

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/projects/${id}`).then((r) => r.json()).then((d) => { setProject(d.project); setLoading(false); });
  }, [id]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!project) return <p className="text-sm text-muted-foreground">Project not found.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{project.name}</h1>
      {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
      <Tabs defaultValue="assets">
        <TabsList>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
        <TabsContent value="assets" className="mt-4">
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Assets can be added from the AI Studio.</CardContent></Card>
        </TabsContent>
        <TabsContent value="conversations" className="mt-4">
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Linked conversations will appear here.</CardContent></Card>
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Notes will appear here.</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
