# Hamilton Dining

A faster way to read Hamilton College dining menus. It has global search, Soper and McEwen side by side, and it keeps working offline.

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

To refresh every morning, add a crontab entry (`crontab -e`):

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
