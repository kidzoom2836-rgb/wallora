import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Wand2 } from "lucide-react";

export function StudioTool({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardContent className="space-y-4 p-5">
          <Textarea placeholder="Describe what you want to create…" className="min-h-[120px]" />
          <Button><Wand2 className="mr-2 h-4 w-4" /> Generate</Button>
          <p className="text-xs text-muted-foreground">
            This studio&apos;s operations are wired up in Phase 7.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}