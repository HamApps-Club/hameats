import saved from "@/public/dining_menu.json";
import { countItems, fetchMenus } from "@/lib/nutrislice";
import type { MenuData } from "@/lib/types";

// Rebuild at most every hour, so a menu the kitchen changes during the day shows up soon after Nutrislice
// posts it. Between rebuilds, Vercel serves the cached copy.
export const revalidate = 3600;

// Paused: while true, nothing calls Nutrislice and the route serves the last scraped file instead.
const NUTRISLICE_PAUSED = true;

export async function GET() {
  if (NUTRISLICE_PAUSED) return Response.json(saved as MenuData);

  const live = await fetchMenus(7, revalidate).catch((e) => {
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
