import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The preview card shown when a hameats.app link is shared in iMessage, Slack, GroupMe, etc. It's the home
// screen's navy header band (see SiteTitle), scaled up: the cream bowl (gold H, gold steam) beside the HamEats wordmark in Zilla
// Slab, "Eats" in gold, over the tagline.
export const alt = "HamEats: Hamilton College dining menus and hours";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The wordmark is Zilla Slab Bold (bundled, as in app/layout.tsx); the tagline is Geist Bold.
// ImageResponse only bundles Geist Regular. Satori reads .woff and .ttf, not .woff2.
const zillaSlabBold = await readFile(join(process.cwd(), "assets/fonts/zilla-slab-latin-700-normal.woff"));
const geistBold = await readFile(join(process.cwd(), "assets/Geist-Bold.ttf"));

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#002F86" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#F6F1E7",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
            <svg width="170" height="170" viewBox="0 0 48 48">
              <path d="M10 24H38A14 14 0 0 1 10 24Z" fill="#F6F1E7" />
              <path d="M20.1 26h1.8a.6.6 0 0 1 .6.6v2.15h3v-2.15a.6.6 0 0 1 .6-.6h1.8a.6.6 0 0 1 .6.6v6.8a.6.6 0 0 1-.6.6h-1.8a.6.6 0 0 1-.6-.6v-2.15h-3v2.15a.6.6 0 0 1-.6.6h-1.8a.6.6 0 0 1-.6-.6v-6.8a.6.6 0 0 1 .6-.6Z" fill="#F0B100" />
              <path
                d="M18 19c-2-2.5 2-4.5 0-8M24 19c-2-2.5 2-4.5 0-8M30 19c-2-2.5 2-4.5 0-8"
                fill="none"
                strokeWidth={3}
                strokeLinecap="round"
                stroke="#F0B100"
              />
            </svg>
            <div style={{ display: "flex", fontFamily: "Zilla Slab", fontSize: 176, fontWeight: 700, lineHeight: 1 }}>
              Ham<span style={{ color: "#F0B100" }}>Eats</span>
            </div>
          </div>
          <div
            style={{
              marginTop: 28,
              fontFamily: "Geist",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 7,
              textTransform: "uppercase",
              opacity: 0.75,
            }}
          >
            Clinton, N.Y. · Dining
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Zilla Slab", data: zillaSlabBold, style: "normal", weight: 700 },
        { name: "Geist", data: geistBold, style: "normal", weight: 700 },
      ],
    },
  );
}
