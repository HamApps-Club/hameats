# HamEats

A faster way to read the campus dining hall menus. It shows which halls are open right now with today's hours, opens each hall on the meal being served, has global search, and keeps working offline.

Covers Soper Commons, McEwen, Howard Diner and Little Pub. Foods show dietary and allergen icons (tap one for its description, serving size, nutrition and ingredients when they're available). It installs as an app (PWA) and works offline: the service worker (`web/app/sw.js/route.ts`) caches the app and the last menus. Every deploy gets its own build ID (the git commit), so installed apps pick up new deploys on their own: opening or returning to the app reloads into the new version, and while it's in use an Update bar appears (`web/components/AppUpdater.tsx`).

Hall hours live in `web/lib/hours.ts`; update them there when the dining schedule changes.

The Cafe tab covers Euphoria, FoJo North and FoJo South. They don't post daily menus, so their menus are typed into `web/lib/cafes.ts` (their hours are in `hours.ts` with the halls'). FoJo shows "Menu coming soon" until its menu is added.

## 1. Menus

`web/app/page.tsx` loads the next 7 days of menus on the server (`web/lib/menuSource.ts`) and builds them into the page. Next.js rebuilds the page when that data expires (hourly during meals, and not until the next meal begins in between). If a refresh fails, the last good page keeps being served. `web/public/dining_menu.json` is only the starting data for a deploy that can't reach the menus.

The menu API's address is the `MENU_API_BASE` setting (`/hameats/MENU_API_BASE` in AWS Parameter Store; `web/.env.local` for local development). Without it, the app shows only the saved starting data.

Howard Diner publishes a PDF menu instead. Its items are transcribed in `web/lib/standingMenus.ts` (the PDF is in `web/public/menus/`); update that file when the Diner posts a new menu. One-off dishes go in `web/lib/specials.ts`.

If a hall's menu is missing on the live site, open `/api/menu/status?key=<STATUS_KEY>` (`STATUS_KEY` is in AWS Parameter Store at `/hameats/STATUS_KEY`; without it the route always 404s): it lists every menu request with its item count or error.

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
