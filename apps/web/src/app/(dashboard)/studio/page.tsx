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

function ratioToSize(r: string): { width: number; height: number } {
  if (r === "16:9") return { width: 1024, height: 576 };
  if (r === "9:16") return { width: 576, height: 1024 };
  if (r === "4:3") return { width: 1024, height: 768 };
  if (r === "3:4") return { width: 768, height: 1024 };
  return { width: 1024, height: 1024 };
}

export default function StudioPage() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState(styles[0]);
  const [ratio, setRatio] = useState(ratios[0]);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { width, height } = ratioToSize(ratio);
      const res = await fetch("/api/v1/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `${prompt}, ${style} style`, width, height }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Generation failed");
      setImage(data.image);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">AI Studio</h1>
        <p className="text-sm text-muted-foreground">Generate original artwork from text using NVIDIA Flux.</p>
      </div>

      <Tabs defaultValue="text-to-image">
        <TabsList>
          <TabsTrigger value="text-to-image">Text to Image</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="saved">Saved</TabsTrigger>
        </TabsList>

        <TabsContent value="text-to-image" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
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
                <Button className="w-full" onClick={generate} disabled={loading}>
                  <Wand2 className="mr-2 h-4 w-4" /> {loading ? "Generating…" : "Generate"}
                </Button>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </CardContent>
            </Card>
            <Card className="flex items-center justify-center p-4">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="Generated" className="max-h-[480px] w-full rounded-lg object-contain" />
              ) : (
                <div className="aspect-square w-full max-w-xs rounded-xl bg-muted/60" />
              )}
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Generation history arrives next.</CardContent></Card>
        </TabsContent>
        <TabsContent value="saved" className="mt-4">
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Saved outputs arrive next.</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
