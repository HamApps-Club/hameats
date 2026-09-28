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

const nextConfig: NextConfig = {
  allowedDevOrigins: lanAddresses,
  env: { BUILD_ID },
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
