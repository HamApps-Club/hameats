# Ham Eats

A faster way to read the campus dining hall menus. It shows which halls are open right now with today's hours, opens each hall on the meal being served, has global search, and keeps working offline.

Hall hours live in `web/lib/hours.ts`; update them there when the dining schedule changes.

## 1. Scrape menus

```sh
python3 scraper/scrape_menu.py                 # next 7 days from today, via the public Nutrislice JSON API
python3 scraper/scrape_menu.py --days 1        # today only
python3 scraper/scrape_menu.py --date 2026-09-24 --days 3
python3 scraper/scrape_menu.py --mode auto     # API first, Playwright if the API fails
```

This writes `dining_menu.json` (the root copy) and `web/public/dining_menu.json` (the copy the app serves).
The schema is `dates -> location -> meal -> station -> [{name, calories, tags}]`.

API mode uses only the Python standard library. Playwright mode loads
`hamiltoncollege.nutrislice.com` in headless Chromium and captures the page's own
`/menu/api/weeks/` responses. It needs:

```sh
pip install -r scraper/requirements.txt && playwright install chromium
```

Howard Diner mostly publishes PDF menus, so it often has no item data.

The live site doesn't depend on this file: `web/app/api/menu/route.ts` fetches the next 7 days straight from Nutrislice on the server and Vercel caches the result for 30 minutes. If a refresh fails, the last good copy keeps being served. The scraped `dining_menu.json` is only the backup the site uses if that route is unavailable, and the starting data if Nutrislice is down during a deploy.

To refresh the backup, run the scraper and commit the two `dining_menu.json` files. To do that automatically every morning, add a crontab entry (`crontab -e`):

```
0 6 * * * cd ~/Documents/cravable && /usr/bin/python3 scraper/scrape_menu.py
```

## 2. Run the app

```sh
cd web
npm run dev        # http://localhost:3000
```

- **Day / Week:** Day shows one day (pick it from the row of days). Week lists every day for the chosen meal.
- **Search:** type any food ("pizza", "omelet") to see every hall, meal and station serving it: that day in Day view, the whole week in Week view.
- **Compare:** Soper Commons and McEwen appear side by side for the selected meal. Check **Diner** to add Howard.
- **Offline:** the last menu is saved in localStorage and shows instantly, then updates quietly when fresh data arrives.
