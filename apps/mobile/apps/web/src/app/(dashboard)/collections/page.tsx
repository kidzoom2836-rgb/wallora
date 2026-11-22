import { Button } from "@/components/ui/button";
import { Plus, Folder } from "lucide-react";
import { EmptyState } from "@/components/wallora/empty-state";

export default function CollectionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Collections</h1>
        <Button><Plus className="mr-2 h-4 w-4" /> New collection</Button>
      </div>
      <EmptyState icon={Folder} title="No collections yet" description="Create collections to organize your favorite visuals." />
    </div>
  );
}