import { EmptyState } from "@/components/wallora/empty-state";
import { BarChart3 } from "lucide-react";

export default function AdminOverviewPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin overview</h1>
      <EmptyState
        icon={BarChart3}
        title="No metrics yet"
        description="Admin analytics are wired to real database queries in Phase 12. No fabricated statistics are shown."
      />
    </div>
  );
}
