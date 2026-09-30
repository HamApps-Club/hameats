import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// Let phones on the same Wi-Fi use the dev server (http://<this Mac's IP>:3000).
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a!.address);

// One ID per deploy: the git commit on Vercel, a timestamp for local builds. The installed app compares it
// with /api/version to know when Vercel has shipped something new (see components/AppUpdater.tsx).
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || `local-${Date.now()}`;

// PostHog is reached through /ingest on this site's own domain, so Firefox tracking protection and
// ad-blockers (which block *.posthog.com) don't silently drop events. See lib/analytics.ts.
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const POSTHOG_ASSETS_HOST = POSTHOG_HOST.replace(".i.posthog.com", "-assets.i.posthog.com");

const nextConfig: NextConfig = {
  allowedDevOrigins: lanAddresses,
  env: { BUILD_ID },
  // PostHog's API paths end in slashes; don't let Next redirect them away.
  skipTrailingSlashRedirect: true,
  async redirects() {
    return [
      {
        // Send the old Vercel address to the real domain, so each visitor has one identity (analytics,
        // saved layout and theme are all per-domain). Only this exact host: preview deploys stay reachable.
        source: "/:path*",
        has: [{ type: "host", value: "hamilton-dining.vercel.app" }],
        destination: "https://www.hameats.app/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: `${POSTHOG_ASSETS_HOST}/static/:path*` },
      { source: "/ingest/array/:path*", destination: `${POSTHOG_ASSETS_HOST}/array/:path*` },
      { source: "/ingest/:path*", destination: `${POSTHOG_HOST}/:path*` },
    ];
  },
  async headers() {
    return [
      {
        // Browsers must always re-check the service worker so updates reach installed apps.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
