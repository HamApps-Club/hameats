import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The preview card shown when a hameats.app link is shared in iMessage, Slack, GroupMe, etc. It's the home
// screen's header (see SiteTitle), scaled up: the bowl mark next to the HamEats wordmark.
export const alt = "HamEats";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The header's font is Geist Bold; ImageResponse only bundles Geist Regular.
const geistBold = await readFile(join(process.cwd(), "assets/Geist-Bold.ttf"));

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 48,
          background: "#fafafa",
          color: "#171717",
          fontFamily: "Geist",
        }}
      >
        <svg width="190" height="190" viewBox="0 0 48 48">
          <rect width="48" height="48" rx="12" fill="#002F86" />
          <path d="M10 24H38A14 14 0 0 1 10 24Z" fill="#FFFFFF" />
          <path
            d="M18 19c-2-2.5 2-4.5 0-8M24 19c-2-2.5 2-4.5 0-8M30 19c-2-2.5 2-4.5 0-8"
            fill="none"
            strokeWidth={3}
            strokeLinecap="round"
            stroke="#F0B100"
          />
        </svg>
        <div style={{ display: "flex", fontSize: 180, fontWeight: 700, letterSpacing: -4.5 }}>
          <span style={{ color: "#002f86" }}>Ham</span>Eats
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Geist", data: geistBold, style: "normal", weight: 700 }] },
  );
}
