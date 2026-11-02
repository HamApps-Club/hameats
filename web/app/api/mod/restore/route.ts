import { idParam } from "@/lib/apiGuard";
import { dbEnabled } from "@/lib/db";
import { getForReview, restorePost, validLink } from "@/lib/moderation";
import { escape, page } from "@/lib/modPage";
import { captureServer } from "@/lib/serverAnalytics";

export const dynamic = "force-dynamic";

// The "Restore it" link in a Discord message about a post the AI photo check hid. Opening it only shows the post and a
// button (so a link preview can't change anything); pressing the button puts the post back. Both need the signature
// from the Discord message.

function check(request: Request) {
  const url = new URL(request.url);
  const id = idParam(url.searchParams.get("id"));
  const sig = url.searchParams.get("sig");
  return url.searchParams.get("type") === "post" && id && validLink("restore", "post", id, sig) ? { id, sig: sig! } : null;
}

export async function GET(request: Request) {
  if (!dbEnabled()) return page("Unavailable", "<p>The database isn't connected.</p>", 503);
  const ok = check(request);
  if (!ok) return page("Link not valid", "<p>This restore link isn't valid.</p>", 403);
  const item = await getForReview("post", ok.id);
  if (!item) return page("Already gone", "<p>This post has been deleted, so it can't be restored.</p>", 404);
  if (!item.hiddenByAi) return page("Already up", "<p>This post isn't hidden. Everyone can see it.</p>");
  return page(
    "Restore this post?",
    `<p><strong>${escape(item.what)}</strong> by u/${escape(item.author)}</p>
${item.body ? `<blockquote>${escape(item.body)}</blockquote>` : ""}
${item.photoUrl ? `<p><img src="${escape(item.photoUrl)}" alt="The post's photo"></p>` : ""}
<form method="post" action="/api/mod/restore?type=post&amp;id=${ok.id}&amp;sig=${escape(ok.sig)}"><button type="submit" style="background:#27ae60">Restore it</button></form>
<p>The AI hid this post. Restoring puts it back in the Feed for everyone, and its photo won't be checked again.</p>`,
  );
}

export async function POST(request: Request) {
  if (!dbEnabled()) return page("Unavailable", "<p>The database isn't connected.</p>", 503);
  const ok = check(request);
  if (!ok) return page("Link not valid", "<p>This restore link isn't valid.</p>", 403);
  try {
    if (!(await restorePost(ok.id))) return page("Nothing to restore", "<p>This post isn't hidden, or it has been deleted.</p>");
    await captureServer("post_restored_by_owner");
    return page("Restored", "<p>The post is back up for everyone.</p>");
  } catch (e) {
    console.error("mod restore failed:", e);
    return page("Something went wrong", "<p>The post couldn't be restored. Try again in a minute.</p>", 503);
  }
}
