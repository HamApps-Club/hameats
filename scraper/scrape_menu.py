#!/usr/bin/env python3
"""Scrape Hamilton College dining menus from Nutrislice into dining_menu.json.

Schema: dates -> location -> meal -> station -> [items]

Modes:
  api         Call the public Nutrislice JSON API directly (default, stdlib only).
  playwright  Load the portal in headless Chromium and capture its API responses.
  auto        Try api first; fall back to playwright on failure or empty result.
"""
import argparse
import datetime as dt
import json
import re
import sys
import time
import urllib.request
from pathlib import Path
from typing import Callable, Dict, List, Optional

BASE_API = "https://hamiltoncollege.api.nutrislice.com"
BASE_PORTAL = "https://hamiltoncollege.nutrislice.com"
USER_AGENT = "Mozilla/5.0 (HamiltonDiningDashboard scraper)"

LOCATIONS = {
    "soper-commons": "Soper Commons",
    "mcewen": "McEwen Dining Hall",
    "howard-diner": "Howard Diner",
    "little-pub": "Little Pub",
}
MEALS = ["breakfast", "lunch", "dinner"]

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUTS = [ROOT / "dining_menu.json", ROOT / "web" / "public" / "dining_menu.json"]
# Nutrislice never posts Commons breakfast. It serves McEwen's: that day's posted menu, or on days
# McEwen posts none (weekends), McEwen's standard weekday breakfast. Same rule as web/lib/mirroredMenus.ts.
COMMONS_BREAKFAST = json.loads((ROOT / "web" / "lib" / "commonsBreakfast.json").read_text(encoding="utf-8"))


# ---------------------------------------------------------------- HTTP (api mode)

def http_json(url: str, retries: int = 2, timeout: int = 20):
    last_err = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001 - retry any network/parse error
            last_err = e
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError("GET %s failed: %s" % (url, last_err))


def week_url(slug: str, meal: str, date: dt.date) -> str:
    # Full weeks endpoint (not the digest); JSON comes back via the Accept header.
    return "%s/menu/api/weeks/school/%s/menu-type/%s/%d/%d/%d" % (
        BASE_API, slug, meal, date.year, date.month, date.day)


def served_meals() -> Dict[str, List[str]]:
    """Every active menu type per location (e.g. "lunch", "pub-menu"), per the schools endpoint."""
    schools = http_json("%s/menu/api/schools/?format=json" % BASE_API)
    return {s["slug"]: [m["slug"] for m in s.get("active_menu_types", [])] for s in schools if s["slug"] in LOCATIONS}


def meal_for_type(menu_type: str) -> Optional[str]:
    """Which meal tab a menu type belongs on (Little Pub's "pub" menus count as dinner)."""
    if "breakfast" in menu_type:
        return "Breakfast"
    if "brunch" in menu_type or "lunch" in menu_type:
        return "Lunch"
    if any(w in menu_type for w in ("dinner", "pub", "late", "night")):
        return "Dinner"
    return None


def fetch_week_api(slug: str, meal: str, date: dt.date) -> dict:
    return http_json(week_url(slug, meal, date))


# ---------------------------------------------------------- Playwright (fallback)

def make_playwright_fetcher():
    """Return (fetch_fn, close_fn) that load the portal page and capture the weeks API JSON."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("Playwright not installed: pip install -r scraper/requirements.txt && playwright install chromium")

    pw = sync_playwright().start()
    browser = pw.chromium.launch(headless=True)
    context = browser.new_context(user_agent=USER_AGENT)

    def fetch(slug: str, meal: str, date: dt.date) -> dict:
        page = context.new_page()
        captured = []
        needle = "/menu/api/weeks/school/"

        def on_response(resp):
            if needle in resp.url and ("/%s/" % slug in resp.url or "/menu-type/" in resp.url):
                try:
                    captured.append(resp.json())
                except Exception:  # noqa: BLE001
                    pass

        page.on("response", on_response)
        url = "%s/menu/%s/%s/%s" % (BASE_PORTAL, slug, meal, date.isoformat())
        page.goto(url, wait_until="networkidle", timeout=60000)
        deadline = time.time() + 15
        while not captured and time.time() < deadline:
            page.wait_for_timeout(500)
        page.close()
        target = date.isoformat()
        for payload in captured:
            if any(d.get("date") == target for d in payload.get("days", [])):
                return payload
        if captured:
            return captured[0]
        raise RuntimeError("No menu API response captured from %s" % url)

    def close():
        context.close()
        browser.close()
        pw.stop()

    return fetch, close


# ------------------------------------------------------------------------ parsing

NUTRIENTS = [("protein", "g_protein"), ("carbs", "g_carbs"), ("fat", "g_fat"),
             ("saturatedFat", "g_saturated_fat"), ("transFat", "g_trans_fat"), ("cholesterolMg", "mg_cholesterol"),
             ("sodium", "mg_sodium"), ("fiber", "g_fiber"), ("sugar", "g_sugar"), ("addedSugar", "g_added_sugar"),
             ("potassiumMg", "mg_potassium"), ("calciumMg", "mg_calcium"), ("ironMg", "mg_iron"),
             ("vitaminDMcg", "mcg_vitamin_d")]


def plain(text) -> Optional[str]:
    """Plain text from a Nutrislice rich-text field (may contain HTML)."""
    out = re.sub(r"\s+", " ", re.sub(r"<[^>]*>", " ", text or "").replace("&nbsp;", " ").replace("&amp;", "&")).strip()
    return out or None


def extras(food: dict) -> dict:
    """Optional detail fields; keys are omitted when Nutrislice has no value."""
    info = food.get("rounded_nutrition_info") or {}
    nutrition = {k: info[f] for k, f in NUTRIENTS if isinstance(info.get(f), (int, float))}
    size = food.get("serving_size_info") or {}
    serving = ("%s %s" % (size.get("serving_size_amount"), size.get("serving_size_unit") or "")).strip() \
        if size.get("serving_size_amount") else None
    out = {"description": plain(food.get("description")), "serving": serving,
           "ingredients": plain(food.get("ingredients")), "nutrition": nutrition or None}
    return {k: v for k, v in out.items() if v}

def parse_day(menu_items: List[dict]) -> Dict[str, List[dict]]:
    """Walk ordered menu items; station headers start a new group."""
    stations: Dict[str, List[dict]] = {}
    current = "General"
    for it in menu_items:
        if it.get("is_station_header") or it.get("is_section_title"):
            name = (it.get("text") or "").strip()
            if name:
                current = name
            continue
        food = it.get("food")
        if not food or not (food.get("name") or "").strip():
            continue
        name = food["name"].strip()
        bucket = stations.setdefault(current, [])
        if any(x["name"] == name for x in bucket):
            continue
        icons = (food.get("icons") or {}).get("food_icons") or []
        bucket.append({
            "name": name,
            "calories": (food.get("rounded_nutrition_info") or {}).get("calories"),
            "tags": [i.get("name") for i in icons if i.get("name")],
            **extras(food),
        })
    return {k: v for k, v in stations.items() if v}


def extract_date(week: dict, date: dt.date) -> Dict[str, List[dict]]:
    target = date.isoformat()
    for day in week.get("days", []):
        if day.get("date") == target:
            return parse_day(day.get("menu_items") or [])
    return {}


# --------------------------------------------------------------------------- main

def scrape(dates: List[dt.date], fetch: Callable[[str, str, dt.date], dict],
           meals_by_loc: Dict[str, List[str]]) -> Dict[str, Dict[str, Dict[str, dict]]]:
    """Return {iso date: {location: {meal: stations}}} for every requested date.

    Each weeks-API response covers a Sunday-Saturday week, so one request
    serves every requested date inside that week.
    """
    result = {d.isoformat(): {name: {} for name in LOCATIONS.values()} for d in dates}
    for slug, display in LOCATIONS.items():
        # Always try breakfast/lunch/dinner, plus whatever else the location lists.
        for meal in dict.fromkeys(MEALS + meals_by_loc.get(slug, [])):
            tab = meal_for_type(meal)
            if not tab:
                continue
            weeks: List[dict] = []
            for date in dates:
                target = date.isoformat()
                week = next((w for w in weeks if any(d.get("date") == target for d in w.get("days", []))), None)
                if week is None:
                    try:
                        week = fetch(slug, meal, date)
                    except Exception as e:  # noqa: BLE001
                        print("  ! %s / %s / %s: %s" % (display, meal, target, e), file=sys.stderr)
                        continue
                    weeks.append(week)
                stations = extract_date(week, date)
                if stations:
                    result[target][display].setdefault(tab, {}).update(stations)
    for day in result.values():
        commons = day["Soper Commons"]
        if not commons.get("Breakfast"):
            commons["Breakfast"] = day["McEwen Dining Hall"].get("Breakfast") or COMMONS_BREAKFAST
    return result


def count_items(days: Dict[str, Dict[str, Dict[str, dict]]]) -> int:
    return sum(len(items) for day in days.values() for loc in day.values()
               for meal in loc.values() for items in meal.values())


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--date", help="first day, YYYY-MM-DD (default: today)")
    ap.add_argument("--days", type=int, default=7, help="number of days to collect (default: 7)")
    ap.add_argument("--mode", choices=["api", "playwright", "auto"], default="api")
    ap.add_argument("--out", action="append", help="output path (repeatable; default: ./dining_menu.json and web/public/)")
    args = ap.parse_args(argv)

    start = dt.date.fromisoformat(args.date) if args.date else dt.date.today()
    dates = [start + dt.timedelta(days=i) for i in range(max(1, args.days))]

    try:
        meals_by_loc = served_meals()
    except Exception as e:  # noqa: BLE001
        print("! could not read schools list (%s); trying all meals" % e, file=sys.stderr)
        meals_by_loc = {}

    days: Dict[str, Dict[str, Dict[str, dict]]] = {}
    mode_used = args.mode
    if args.mode in ("api", "auto"):
        days = scrape(dates, fetch_week_api, meals_by_loc)
        mode_used = "api"
    if args.mode == "playwright" or (args.mode == "auto" and count_items(days) == 0):
        if args.mode == "auto":
            print("API returned nothing; falling back to Playwright...", file=sys.stderr)
        fetch, close = make_playwright_fetcher()
        try:
            days = scrape(dates, fetch, meals_by_loc)
        finally:
            close()
        mode_used = "playwright"

    data = {
        "generated_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "source": BASE_API.replace("https://", ""),
        "mode": mode_used,
        "dates": days,
    }

    outputs = [Path(p) for p in args.out] if args.out else DEFAULT_OUTPUTS
    for path in outputs:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print("Menus %s to %s (mode: %s)" % (dates[0], dates[-1], mode_used))
    for iso, day in days.items():
        parts = []
        for loc, meals in day.items():
            counts = "/".join("%s %d" % (m[0], sum(len(v) for v in st.values())) for m, st in meals.items())
            parts.append("%s: %s" % (loc.split()[0], counts or "-"))
        print("  %s  %s" % (iso, "   ".join(parts)))
    print("Wrote: " + ", ".join(str(p) for p in outputs))
    return 0 if count_items(days) else 1


if __name__ == "__main__":
    sys.exit(main())
