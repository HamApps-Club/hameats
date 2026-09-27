import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ham Eats",
    short_name: "Ham Eats",
    description: "Dining hall menus and hours",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#fafafa",
    icons: [
      { src: "/icons/icon-192.png?v=3", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png?v=3", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png?v=3", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
