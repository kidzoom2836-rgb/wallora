"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VerificationProvider } from "@/components/verification/verification-gate";

/**
 * Client providers wrapper. Mounted once in the root layout so that
 * `useSession` and TanStack Query work anywhere in the tree.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30s — fresh enough for discovery, not stale
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <VerificationProvider>{children}</VerificationProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
