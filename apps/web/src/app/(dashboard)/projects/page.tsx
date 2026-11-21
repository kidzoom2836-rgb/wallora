import { Button } from "@/components/ui/button";
import { Plus, FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/wallora/empty-state";

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Creative Projects</h1>
        <Button><Plus className="mr-2 h-4 w-4" /> New project</Button>
      </div>
      <EmptyState icon={FolderKanban} title="No projects yet" description="Create a project to organize conversations, images and notes." />
    </div>
  );
}