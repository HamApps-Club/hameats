import posthog from "posthog-js";

let initialized = false;

/** Initializes PostHog once, client-side only. No-ops (silently) if no key is configured. */
export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
  });
  initialized = true;
}

/** Fires an event if PostHog is initialized; otherwise a no-op. */
export function track(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, properties);
}
