# HamEats

A faster way to read the campus dining hall menus. It shows which halls are open right now with today's hours, opens each hall on the meal being served, has global search, and keeps working offline.

Covers Soper Commons, McEwen, Howard Diner and Little Pub. Foods show dietary and allergen icons (tap one for its description, serving size, nutrition and ingredients when the menu source provides them). It installs as an app (PWA) and works offline: the service worker (`web/app/sw.js/route.ts`) caches the app and the last menus. Every deploy gets its own build ID (the git commit), so installed apps pick up new deploys on their own: opening or returning to the app reloads into the new version, and while it's in use an Update bar appears (`web/components/AppUpdater.tsx`).

Hall hours live in `web/lib/hours.ts`; update them there when the dining schedule changes.

## 1. Menus

Menus are loaded on the server; see `web/lib/` for details.

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
