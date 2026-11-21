"use client";

import { useEffect } from "react";

/**
 * Registers the WALLORA service worker for PWA support (Phase 10).
 * Enables offline app shell loading and cached asset delivery.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
      } catch {
        // Registration failed — non-fatal, the app works without SW
      }
    };

    // Register after page load to avoid blocking
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
