import { Card, CardContent } from "@/components/ui/card";
export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
        This admin section is implemented in Phase 12.
      </CardContent></Card>
    </div>
  );
}
