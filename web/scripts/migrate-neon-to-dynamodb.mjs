// One-time copy of everyone's favorites and notifications setting from the old Neon database into DynamoDB.
//
//   cd web
//   node --env-file=.env.local scripts/migrate-neon-to-dynamodb.mjs --dry-run   # shows what it would copy
//   node --env-file=.env.local scripts/migrate-neon-to-dynamodb.mjs             # copies it
//
// .env.local needs DATABASE_URL (Neon). DynamoDB is reached with your AWS command-line login (`aws configure`), or with
// HAMEATS_AWS_ACCESS_KEY_ID / HAMEATS_AWS_SECRET_ACCESS_KEY if set; HAMEATS_DYNAMODB_TABLE (default hameats-users) and
// HAMEATS_AWS_REGION (default us-east-1) name the table. Safe to run more than once: it
// merges into what's already in DynamoDB (favorites are added, never removed). Nothing in Neon is changed.
// Copied per person: their email, favorites, and, only when they had alerts and push on with a phone signed up, the
// notifications switch and those phones' push addresses. Saved notifications and the old Feed are not copied.

import { neon } from "@neondatabase/serverless";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const dryRun = process.argv.includes("--dry-run");
if (!process.env.DATABASE_URL?.trim()) {
  console.error("Missing in .env.local: DATABASE_URL (Neon's connection string)");
  process.exit(1);
}
const keyId = process.env.HAMEATS_AWS_ACCESS_KEY_ID?.trim();
const keySecret = process.env.HAMEATS_AWS_SECRET_ACCESS_KEY?.trim();

const sql = neon(process.env.DATABASE_URL);
const TABLE = process.env.HAMEATS_DYNAMODB_TABLE?.trim() || "hameats-users";
const db = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.HAMEATS_AWS_REGION?.trim() || "us-east-1",
    // Without a key here, the AWS SDK uses your `aws configure` login.
    ...(keyId && keySecret ? { credentials: { accessKeyId: keyId, secretAccessKey: keySecret } } : {}),
    ...(process.env.HAMEATS_DYNAMODB_ENDPOINT ? { endpoint: process.env.HAMEATS_DYNAMODB_ENDPOINT } : {}),
  }),
);

/** Rows from a table that may not exist in this database (an older or newer schema). */
async function rows(query) {
  try {
    return await sql.query(query);
  } catch (e) {
    if (e?.code === "42P01") return [];
    throw e;
  }
}

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The favorites table if this database has one; otherwise the thumbs ups it was made from.
let favoriteRows = await rows("SELECT user_id, dish FROM favorites ORDER BY created_at, dish");
if (!favoriteRows.length) favoriteRows = await rows("SELECT user_id, dish FROM dish_likes WHERE value = 1 ORDER BY created_at, dish");
const prefs = await rows("SELECT user_id FROM notification_prefs WHERE alerts AND push");
const phones = await rows("SELECT user_id, endpoint, p256dh, auth FROM push_subscriptions ORDER BY created_at");
const profiles = await rows("SELECT user_id, created_at FROM profiles");

const people = new Map();
const person = (email) => {
  const key = String(email).trim().toLowerCase();
  if (!people.has(key)) people.set(key, { email: key, favorites: [], notify: false, push: [], createdAt: null });
  return people.get(key);
};
for (const r of profiles) person(r.user_id).createdAt = new Date(r.created_at).toISOString();
for (const r of favoriteRows) {
  const p = person(r.user_id);
  if (!p.favorites.some((f) => same(f, r.dish))) p.favorites.push(r.dish);
}
const notifyOn = new Set(prefs.map((r) => String(r.user_id).trim().toLowerCase()));
for (const r of phones) {
  const p = person(r.user_id);
  if (notifyOn.has(p.email)) p.push.push({ endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth });
}
for (const p of people.values()) p.notify = p.push.length > 0;

const list = [...people.values()];
console.log(
  `${list.length} people, ${list.reduce((n, p) => n + p.favorites.length, 0)} favorites, ${list.filter((p) => p.notify).length} with notifications on.`,
);
if (dryRun) {
  for (const p of list) console.log(`  ${p.email.split("@")[0]}: ${p.favorites.length} favorites${p.notify ? ", notifications on" : ""}`);
  console.log("Dry run: nothing was written.");
  process.exit(0);
}

let written = 0;
for (const p of list) {
  // Merge with anything already there (the new app may already be live), and only write if nobody changed it meanwhile.
  for (let attempt = 0; ; attempt++) {
    const { Item } = await db.send(new GetCommand({ TableName: TABLE, Key: { email: p.email }, ConsistentRead: true }));
    const favorites = [...(Item?.favorites ?? [])];
    for (const f of p.favorites) if (!favorites.some((x) => same(x, f))) favorites.push(f);
    const push = [...(Item?.push ?? [])];
    for (const ph of p.push) if (!push.some((x) => x.endpoint === ph.endpoint)) push.push(ph);
    const version = typeof Item?.version === "number" ? Item.version : 0;
    try {
      await db.send(
        new PutCommand({
          TableName: TABLE,
          Item: {
            email: p.email,
            favorites: favorites.slice(0, 300),
            notify: Item?.notify === true || p.notify,
            push: push.slice(-5),
            createdAt: Item?.createdAt ?? p.createdAt ?? new Date().toISOString(),
            version: version + 1,
          },
          ConditionExpression: Item ? "version = :v OR attribute_not_exists(version)" : "attribute_not_exists(email)",
          ...(Item ? { ExpressionAttributeValues: { ":v": version } } : {}),
        }),
      );
      written++;
      break;
    } catch (e) {
      if (e?.name !== "ConditionalCheckFailedException" || attempt >= 4) throw e;
    }
  }
}
console.log(`Done: ${written} people copied to ${TABLE}.`);
