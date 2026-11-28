import posthog from "posthog-js";

let initialized = false;

/** Initializes PostHog once, client-side only. No-ops (silently) if no key is configured. */
export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    // Proxied through this site (see next.config.ts) so tracking protection doesn't block it.
    api_host: "/ingest",
    ui_host: (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(".i.posthog.com", ".posthog.com"),
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    // Send events uncompressed. posthog-js labels its gzip batches text/plain, and the Lambda function URL behind
    // /ingest treats text/plain bodies as UTF-8 text, which corrupts the gzip bytes: PostHog then rejects the batch
    // ("invalid GZIP data") and most events, including every $pageview, were lost after the move to AWS.
    disable_compression: true,
    // No screen recordings for any HamApps app.
    disable_session_recording: true,
  });
  initialized = true;
}

/** Fires an event if PostHog is initialized; otherwise a no-op. */
export function track(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, properties);
}
