import saved from "@/public/dining_menu.json";
import { countItems, fetchMenus, menuCacheSeconds } from "@/lib/menuSource";
import type { MenuData } from "@/lib/types";
import { HomeClient } from "./HomeClient";

// The page is built on the server with the menus inside it. Next rebuilds the page when the shortest-lived menu
// response in it expires (see menuCacheSeconds): hourly during meals. Between meals the page is rebuilt at most
// hourly too, but the menu responses stay cached until the next meal, so no extra requests are made. The hourly cap
// also means a page built from the saved file (menus unreachable during a deploy) is replaced within the hour.
export const revalidate = 3600;

export default async function Home() {
  const live = await fetchMenus(7, menuCacheSeconds()).catch((e) => {
    console.error("menu fetch failed:", e);
    return null;
  });
  if (live && countItems(live) > 0) {
    return <HomeClient initialMenu={live} />;
  }

  // The menu API is down or returned nothing. A failed rebuild keeps the last good page in the cache; a first
  // build (a deploy) starts from the saved file, whose age sends the app to fetch fresh menus.
  if (process.env.NEXT_PHASE === "phase-production-build") return <HomeClient initialMenu={saved as MenuData} />;
  throw new Error("The menu API returned no menu items");
}
