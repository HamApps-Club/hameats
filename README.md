# HamEats

A faster way to read the campus dining hall menus. It shows which halls are open right now with today's hours, opens each hall on the meal being served, has global search, and keeps working offline.

Covers Soper Commons, McEwen, Howard Diner and Little Pub. Foods show dietary and allergen icons (tap one for its description, serving size, nutrition and ingredients when Nutrislice provides them). It installs as an app (PWA) and works offline: the service worker (`web/app/sw.js/route.ts`) caches the app and the last menus. Every Vercel deploy gets its own build ID, so installed apps pick up new deploys on their own: opening or returning to the app reloads into the new version, and while it's in use an Update bar appears (`web/components/AppUpdater.tsx`).

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

Howard Diner publishes a PDF menu instead of Nutrislice items. Its items are transcribed in `web/lib/standingMenus.ts` (the PDF is in `web/public/menus/`) and fill in whenever Nutrislice has nothing posted for the Diner; update that file when the Diner posts a new menu.

If a hall's menu is missing on the live site, open `/api/menu/status?key=<STATUS_KEY>` (set `STATUS_KEY` in Vercel's environment variables; without it the route always 404s): it lists every Nutrislice request with its item count or error.

The live site doesn't depend on this file: `web/app/page.tsx` fetches the next 7 days straight from Nutrislice on the server and builds them into the page. Vercel rebuilds the page when the Nutrislice data expires (hourly during meals, and not until the next meal begins in between), so Nutrislice is only contacted when a student opens the app after that. If a refresh fails, the last good page keeps being served. The scraped `dining_menu.json` is only the starting data if Nutrislice is down during a deploy.

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

## 3. AWS (hosting, favorites, the 8 AM alert)

HamEats runs on AWS: the Next.js server on Lambda behind CloudFront, favorites in DynamoDB, and the 8 AM alert on EventBridge Scheduler, all inside AWS's always-free allowances. Every push to `main` that touches `web/` builds and deploys it (`.github/workflows/deploy-aws.yml`). The setup, from scratch, is in **[infra/aws/README.md](infra/aws/README.md)**; everything AWS creates is in `infra/aws/hameats.yaml`.

People who log in can save favorite dishes and turn on an 8 AM push notification about them. That is the only thing saved, all in one DynamoDB table with one item per person (`web/lib/users.ts`): their email, their favorites, whether notifications are on, and (only while they're on) the push address of each phone that allowed them.

For local development against the real table, set `HAMEATS_DYNAMODB_TABLE`, `HAMEATS_AWS_REGION`, `HAMEATS_AWS_ACCESS_KEY_ID` and `HAMEATS_AWS_SECRET_ACCESS_KEY` in `web/.env.local` (see `web/.env.local.example`). Without them, favorites and notifications are switched off and the rest of the app works as usual.

To delete someone's account when they ask, delete their item (their email) from the table in the DynamoDB console.
