"use client";

import * as React from "react";
import { ExternalLink, Play } from "lucide-react";

/** Nine-second muted preview used for WALLORA TV channel recommendations. */
export function ChannelClipPreview({
  src,
  poster,
  title,
  channelName,
  durationSec = 9,
}: {
  src: string;
  poster?: string | null;
  title: string;
  channelName?: string | null;
  durationSec?: number | null;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const timer = window.setTimeout(() => video.pause(), (durationSec || 9) * 1000);
    return () => window.clearTimeout(timer);
  }, [durationSec, src]);

  return (
    <div className="ml-[52px] mt-4 overflow-hidden rounded-xl border border-primary/25 bg-black">
      <div className="relative">
        <video
          ref={videoRef}
          src={src}
          poster={poster ?? undefined}
          muted
          autoPlay
          loop
          playsInline
          preload="metadata"
          className="max-h-[420px] w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white">
          <span className="size-1.5 rounded-full bg-red-500" />
          {durationSec || 9}s PREVIEW
        </div>
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {channelName || "WALLORA TV"}
            </p>
            <p className="truncate text-xs text-white/70">{title}</p>
          </div>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-background"
          >
            <Play className="size-3" />
            Watch
            <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
