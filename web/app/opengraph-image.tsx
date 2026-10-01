import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION } from "@/lib/site";

// The preview card shown when a hameats.app link is shared in iMessage, Slack, GroupMe, etc.
export const alt = "HamEats: dining menus and hours";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#fafafa",
          color: "#18181b",
        }}
      >
        <div style={{ display: "flex", fontSize: 128, fontWeight: 700, letterSpacing: -4 }}>
          <span style={{ color: "#002f86" }}>Ham</span>Eats
        </div>
        <div style={{ fontSize: 40, marginTop: 24, color: "#3f3f46", maxWidth: 1000 }}>{SITE_DESCRIPTION}</div>
        <div style={{ fontSize: 32, marginTop: 48, color: "#002f86", fontWeight: 600 }}>hameats.app</div>
      </div>
    ),
    size,
  );
}
