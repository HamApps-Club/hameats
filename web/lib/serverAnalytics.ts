import "server-only";

// Events the server sends to PostHog itself, for things that happen where the browser can't see them: the AI photo
// check, posts it hides, the owner's Remove and Restore links, and Discord messages. They use PostHog's capture API
// directly (no SDK) and carry no person, so they never create or merge user profiles.

const TEST_ACCOUNT = "test@hameats.app";

/** Whether this account is the private test login (lib/auth.ts), so tiles can leave the owner's testing out. */
export const isTestAccount = (userId: unknown) => userId === TEST_ACCOUNT;

/** Sends one event. Never throws and never waits long; without NEXT_PUBLIC_POSTHOG_KEY it does nothing. */
export async function captureServer(event: string, properties: Record<string, unknown> = {}) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
  try {
    await fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id: "hameats-server",
        properties: { ...properties, source: "server", $process_person_profile: false },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (e) {
    console.error(`PostHog event ${event} not sent:`, e);
  }
}
