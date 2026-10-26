"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

/** Initializes PostHog on mount. Client-side only, and a no-op without a configured key. */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initAnalytics();
  }, []);
  return <>{children}</>;
}
