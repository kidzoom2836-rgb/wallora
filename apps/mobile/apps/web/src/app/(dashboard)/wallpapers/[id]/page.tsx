import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Bookmark, Download, Share2, Flag } from "lucide-react";
import Link from "next/link";

export default async function WallpaperDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-muted" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button><Download className="mr-2 h-4 w-4" /> Download</Button>
          <Button variant="outline"><Heart className="mr-2 h-4 w-4" /> Like</Button>
          <Button variant="outline"><Bookmark className="mr-2 h-4 w-4" /> Save</Button>
          <Button variant="outline"><Share2 className="mr-2 h-4 w-4" /> Share</Button>
          <Button variant="ghost"><Flag className="mr-2 h-4 w-4" /> Report</Button>
        </div>
      </div>
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-5">
            <h1 className="text-xl font-semibold">Wallpaper #{id}</h1>
            <p className="text-sm text-muted-foreground">A beautiful visual for your device.</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">4K</Badge>
              <Badge variant="secondary">Portrait</Badge>
              <Badge variant="secondary">Free</Badge>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Creator</dt><dd><Link href="/creators/demo" className="text-primary hover:underline">demo</Link></dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Resolution</dt><dd>3840×2160</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Format</dt><dd>JPEG</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Size</dt><dd>—</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">License</dt><dd>Personal use</dd></div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 font-semibold">Related</h3>
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-square rounded-lg bg-muted" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}