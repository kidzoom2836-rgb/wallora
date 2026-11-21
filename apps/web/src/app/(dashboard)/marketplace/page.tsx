import { EmptyState } from "@/components/wallora/empty-state";
import { ShoppingBag } from "lucide-react";

export default function MarketplacePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Marketplace</h1>
      <EmptyState icon={ShoppingBag} title="No products yet" description="Marketplace listings will appear here." />
    </div>
  );
}