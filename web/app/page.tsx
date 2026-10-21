import saved from "@/public/dining_menu.json";
import { countItems, fetchMenus, menuCacheSeconds } from "@/lib/nutrislice";
import type { MenuData } from "@/lib/types";
import { HomeClient } from "./HomeClient";

// The page is built on the server with the menus inside it, and Vercel rebuilds it at most once an hour. The
// Nutrislice responses are reused for an hour during meals and until the next meal begins in between (see
// menuCacheSeconds), so a menu the kitchen changes during a meal shows up within the hour.
export const revalidate = 3600;

export default async function Home() {
  const live = await fetchMenus(7, menuCacheSeconds()).catch((e) => {
    console.error("menu fetch failed:", e);
    return null;
  });
  if (live && countItems(live) > 0) return <HomeClient initialMenu={live} />;

  // Nutrislice is down or returned nothing. A failed rebuild keeps the last good page in the cache; a first
  // build (a deploy) starts from the last scraped file, whose age sends the app to fetch fresh menus.
  if (process.env.NEXT_PHASE === "phase-production-build") return <HomeClient initialMenu={saved as MenuData} />;
  throw new Error("Nutrislice returned no menu items");
}
