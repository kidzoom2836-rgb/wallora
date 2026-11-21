"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wand2 } from "lucide-react";

const styles = ["Cinematic", "Minimalist", "Luxury", "Cyberpunk", "Nature", "Futuristic", "Abstract", "Architecture", "Photography", "Digital illustration", "Anime-inspired original art"];
const ratios = ["1:1", "16:9", "9:16", "4:3", "3:4"];

export default function StudioPage() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState(styles[0]);
  const [ratio, setRatio] = useState(ratios[0]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">AI Studio</h1>
        <p className="text-sm text-muted-foreground">Generate original artwork from text.</p>
      </div>

      <Tabs defaultValue="text-to-image">
        <TabsList>
          <TabsTrigger value="text-to-image">Text to Image</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="saved">Saved</TabsTrigger>
        </TabsList>

        <TabsContent value="text-to-image" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prompt</label>
                  <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the image you want…" className="min-h-[120px]" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Style</label>
                    <Select value={style} onValueChange={(v) => v && setStyle(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{styles.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Aspect ratio</label>
                    <Select value={ratio} onValueChange={(v) => v && setRatio(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ratios.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  <span className="text-muted-foreground">Estimated credit usage</span>
                  <span className="font-medium text-primary">1 credit</span>
                </div>
                <Button className="w-full" onClick={() => {}}>
                  <Wand2 className="mr-2 h-4 w-4" /> Generate
                </Button>
                <p className="text-xs text-muted-foreground">
                  Generation is wired up in Phase 6. This is a UI preview.
                </p>
              </CardContent>
            </Card>
            <Card className="flex items-center justify-center">
              <div className="aspect-square w-full max-w-xs rounded-xl bg-muted/60" />
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Generation history arrives in Phase 6.</CardContent></Card>
        </TabsContent>
        <TabsContent value="saved" className="mt-4">
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Saved outputs arrive in Phase 6.</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}