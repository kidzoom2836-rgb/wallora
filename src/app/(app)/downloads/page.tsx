"use client";

import * as React from "react";
import Link from "next/link";
import { Download, ExternalLink, ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { clearDownloads, readDownloads, removeDownload, type WebDownload } from "@/lib/downloads-client";

function formatDate(timestamp: number) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(timestamp));
  } catch {
    return "Recently";
  }
}

export default function DownloadsPage() {
  const [items, setItems] = React.useState<WebDownload[]>([]);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setItems(readDownloads());
    setReady(true);
  }, []);

  const handleRemove = (id: string) => {
    removeDownload(id);
    setItems((current) => current.filter((item) => item.id !== id));
    toast.success("Removed from this list");
  };

  const handleClear = () => {
    clearDownloads();
    setItems([]);
    toast.success("Download list cleared");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your library</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Downloads</h1>
          <p className="mt-2 max-w-2xl text-sm text-secondary-text">
            Wallpapers you downloaded from this browser. This list is stored on this device only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <Button variant="ghost" className="text-secondary-text hover:text-destructive" onClick={handleClear}>
              <Trash2 className="mr-2 size-4" />
              Clear list
            </Button>
          )}
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/discover">
              <Download className="mr-2 size-4" />
              Find wallpapers
            </Link>
          </Button>
        </div>
      </header>

      {!ready ? (
        <div className="mt-10 h-40 animate-shimmer rounded-2xl border border-border" />
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <Download className="mx-auto size-8 text-primary" />
          <p className="mt-4 text-sm font-medium text-foreground">No downloads recorded yet</p>
          <p className="mt-1 text-xs text-secondary-text">
            Open a wallpaper and use Download. It will appear here with a direct link to the file.
          </p>
          <Button asChild className="mt-5 bg-primary text-primary-foreground">
            <Link href="/discover">Browse wallpapers</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-primary/40"
            >
              <div className="relative aspect-video overflow-hidden bg-raised">
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-secondary-text">
                    <ImageIcon className="size-8" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h2 className="truncate text-sm font-semibold text-foreground">{item.title}</h2>
                <p className="mt-1 truncate text-xs text-secondary-text">
                  {item.creator ?? "WALLORA creator"} · {formatDate(item.downloadedAt)}
                </p>
                <p className="mt-2 truncate text-[11px] text-secondary-text/80" title={item.filename}>
                  {item.filename}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <a
                    href={item.remoteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    <ExternalLink className="size-3.5" />
                    Open file
                  </a>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="text-secondary-text hover:text-foreground"
                    aria-label={`View ${item.title}`}
                  >
                    <Link href={`/wallpaper/${item.slug}`}>
                      <ImageIcon className="size-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-secondary-text hover:text-destructive"
                    onClick={() => handleRemove(item.id)}
                    aria-label={`Remove ${item.title} from list`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
