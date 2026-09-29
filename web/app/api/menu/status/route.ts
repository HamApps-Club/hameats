import { countItems, fetchMenus, type FetchLog } from "@/lib/nutrislice";

// Diagnostics: what Nutrislice returned for each location and menu type, fetched fresh on every request.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Owner only: every call hits Nutrislice uncached, so require ?key= to match STATUS_KEY (unset = always refused).
  const key = new URL(request.url).searchParams.get("key");
  if (!process.env.STATUS_KEY || key !== process.env.STATUS_KEY) return new Response("Not found", { status: 404 });

  const log: FetchLog[] = [];
  const data = await fetchMenus(7, 0, log);
  const byLocation: Record<string, Record<string, number>> = {};
  for (const day of Object.values(data.dates))
    for (const [loc, meals] of Object.entries(day))
      for (const [meal, stations] of Object.entries(meals)) {
        byLocation[loc] ??= {};
        byLocation[loc][meal] = (byLocation[loc][meal] ?? 0) + Object.values(stations).reduce((n, s) => n + s.length, 0);
      }
  return Response.json({ checked_at: data.generated_at, total_items: countItems(data), items_by_location: byLocation, requests: log });
}
