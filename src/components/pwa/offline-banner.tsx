"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AlertIcon, DownloadIcon, RefreshIcon } from "@/components/icons/wallora-icons";

/**
 * Global connectivity banner. Shows whenever the browser reports it is offline,
 * except on /downloads where locally saved content is intentionally usable
 * without a connection. Offers a retry action and a route to offline downloads.
 */
export function OfflineBanner() {
  const pathname = usePathname();
  const [offline, setOffline] = React.useState(false);
  const [checking, setChecking] = React.useState(false);

  React.useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const retry = React.useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/v1/health", { cache: "no-store" });
      if (res.ok) {
        setOffline(false);
      }
    } catch {
      setOffline(!navigator.onLine);
    } finally {
      setChecking(false);
    }
  }, []);

  if (!offline || pathname === "/downloads") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[70] flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center text-xs text-amber-200 backdrop-blur-md sm:text-sm"
    >
      <span className="inline-flex items-center gap-2 font-medium">
        <AlertIcon size={16} className="text-amber-300" />
        You are currently offline. Some content may not update.
      </span>
      <span className="inline-flex items-center gap-3">
        <button
          type="button"
          onClick={retry}
          disabled={checking}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/40 px-2.5 py-1 font-medium text-amber-100 transition hover:bg-amber-400/15 disabled:opacity-60"
        >
          <RefreshIcon size={14} className={checking ? "animate-spin" : ""} />
          {checking ? "Retrying…" : "Retry connection"}
        </button>
        <Link
          href="/downloads"
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/40 px-2.5 py-1 font-medium text-amber-100 transition hover:bg-amber-400/15"
        >
          <DownloadIcon size={14} />
          Go to downloads
        </Link>
      </span>
    </div>
  );
}
