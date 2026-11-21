import { Heart, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ImageCard({
  title,
  creator,
  src,
  aspect = "aspect-[3/4]",
}: {
  title: string;
  creator: string;
  src: string;
  aspect?: string;
}) {
  return (
    <div className="group overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/40">
      <div className={`relative ${aspect} overflow-hidden bg-muted`}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">Preview</div>
        )}
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
          <Button size="icon" variant="secondary" className="h-8 w-8" aria-label="Like">
            <Heart className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="secondary" className="h-8 w-8" aria-label="Save">
            <Bookmark className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="space-y-1 p-3">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{creator}</p>
      </div>
    </div>
  );
}
