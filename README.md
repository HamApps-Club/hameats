# HamEats

A faster way to read the campus dining hall menus. It shows which halls are open right now with today's hours, opens each hall on the meal being served, has global search, and keeps working offline.

Covers Soper Commons, McEwen, Howard Diner and Little Pub. Foods show dietary and allergen icons (tap one for its description, serving size, nutrition and ingredients when the menu source provides them). It installs as an app (PWA) and works offline: the service worker (`web/app/sw.js/route.ts`) caches the app and the last menus. Every Vercel deploy gets its own build ID, so installed apps pick up new deploys on their own: opening or returning to the app reloads into the new version, and while it's in use an Update bar appears (`web/components/AppUpdater.tsx`).

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

## 3. Favorites database (DynamoDB)

People who log in can save favorite dishes and turn on an 8 AM push notification about them. That is the only thing saved, all in one DynamoDB table with one item per person (`web/lib/users.ts`): their email, their favorites, whether notifications are on, and (only while they're on) the push address of each phone that allowed them. Without the four `HAMEATS_*` settings below, the app runs as before with favorites and notifications switched off.

### Set it up (once)

1. **Create the table.** AWS console → DynamoDB → Create table. Name: `hameats-users`. Partition key: `email` (String), no sort key. Table settings: Customize → Capacity mode: On-demand. Create.
2. **Create a user for the app.** IAM → Users → Create user, named `hameats-app`, with no console access. On its Permissions tab: Add permissions → Create inline policy → JSON, paste the policy below (put in your region and 12-digit account ID), and name it `hameats-users-table`.

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Scan"],
       "Resource": "arn:aws:dynamodb:us-east-1:123456789012:table/hameats-users"
     }]
   }
   ```
3. **Make its access key.** On the user's Security credentials tab: Create access key → "Application running outside AWS". Copy both values; the secret is shown only once.
4. **Add the settings in Vercel** (Project → Settings → Environment Variables, Production): `HAMEATS_AWS_REGION` (e.g. `us-east-1`), `HAMEATS_DYNAMODB_TABLE` (`hameats-users`), `HAMEATS_AWS_ACCESS_KEY_ID` and `HAMEATS_AWS_SECRET_ACCESS_KEY`. (Vercel keeps the plain `AWS_*` names for itself.) `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `CRON_SECRET` stay as they are.
5. **Copy everyone over from Neon.** In `web/.env.local`, put `DATABASE_URL` (Neon's connection string, from Vercel → Storage → your Neon database) and the four `HAMEATS_*` values, then:

   ```sh
   cd web
   node --env-file=.env.local scripts/migrate-neon-to-dynamodb.mjs --dry-run   # what it would copy
   node --env-file=.env.local scripts/migrate-neon-to-dynamodb.mjs             # copy it
   ```

   It copies each person's favorites, and turns notifications on for those who had alerts and push on with a phone signed up. It doesn't change Neon and is safe to run again.
6. **Deploy** (push to `main`).
7. **Remove Neon and the old photos.** Once the deployed app shows favorites: in Vercel, delete the Neon database and the Blob store (Storage), and remove `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `ANTHROPIC_API_KEY`, `REPORT_WEBHOOK_URL` and `MODERATION_SECRET`. Then `npm uninstall @neondatabase/serverless` in `web` and delete `web/scripts/migrate-neon-to-dynamodb.mjs`.

To delete someone's account when they ask, delete their item (their email) from the table in the DynamoDB console.
