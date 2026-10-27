import "server-only";

/**
 * Posts a message to the Discord channel behind REPORT_WEBHOOK_URL (set in Vercel's environment variables). Never
 * throws and never waits long: a report is saved whether or not the notice gets through.
 */
export async function notifyOwner(content: string) {
  const url = process.env.REPORT_WEBHOOK_URL;
  if (!url) {
    console.warn("REPORT_WEBHOOK_URL is not set; report notice not sent");
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Review text is written by students, so it must never be able to ping anyone (@everyone and the like).
      body: JSON.stringify({ content: content.slice(0, 1900), allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) console.error("report notice failed:", res.status);
  } catch (e) {
    console.error("report notice failed:", e);
  }
}
