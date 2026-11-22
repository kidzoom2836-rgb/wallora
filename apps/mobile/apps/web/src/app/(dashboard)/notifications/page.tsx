import { EmptyState } from "@/components/wallora/empty-state";
import { Bell } from "lucide-react";

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Notifications</h1>
      <EmptyState icon={Bell} title="No notifications" description="You're all caught up." />
    </div>
  );
}