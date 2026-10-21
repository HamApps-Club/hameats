import saved from "@/public/dining_menu.json";
import { countItems, fetchMenus, menuCacheSeconds } from "@/lib/nutrislice";
import type { MenuData } from "@/lib/types";

// Rebuild at most every hour. The Nutrislice responses inside are reused for an hour during meals and until the next
// meal begins in between (see menuCacheSeconds), so a menu the kitchen changes during a meal shows up within the hour.
export const revalidate = 3600;

export async function GET() {
  const live = await fetchMenus(7, menuCacheSeconds()).catch((e) => {
    console.error("menu fetch failed:", e);
    return null;
  });
  if (live && countItems(live) > 0) return Response.json(live);

  // Nutrislice is down or returned nothing.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    // Don't fail the deploy: start from the last scraped file; the next refresh replaces it.
    return Response.json(saved as MenuData);
  }
  // During a background refresh, throwing keeps the last good copy in the cache instead of replacing it.
  throw new Error("Nutrislice returned no menu items");
}
