import { idParam } from "@/lib/apiGuard";
import { dbEnabled } from "@/lib/db";
import { getForReview, removeAsOwner, validLink, type Target } from "@/lib/moderation";
import { escape, page } from "@/lib/modPage";
import { captureServer } from "@/lib/serverAnalytics";

export const dynamic = "force-dynamic";

// The "Remove" link in each Discord message. Opening it only shows the post and a button (so a link preview can't
// remove anything); pressing the button removes it. Both need the signature from the Discord message.

function check(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const target: Target | null = type === "post" || type === "comment" ? type : null;
  const id = idParam(url.searchParams.get("id"));
  const sig = url.searchParams.get("sig");
  return target && id && validLink("remove", target, id, sig) ? { target, id, sig: sig! } : null;
}

export async function GET(request: Request) {
  if (!dbEnabled()) return page("Unavailable", "<p>The database isn't connected.</p>", 503);
  const ok = check(request);
  if (!ok) return page("Link not valid", "<p>This removal link isn't valid.</p>", 403);
  const item = await getForReview(ok.target, ok.id);
  if (!item) return page("Already gone", `<p>This ${ok.target} has already been deleted.</p>`, 404);
  return page(
    `Remove this ${ok.target}?`,
    `<p><strong>${escape(item.what)}</strong> by u/${escape(item.author)}</p>
${item.onPost ? `<p>On: ${escape(item.onPost.slice(0, 300))}</p>` : ""}
${item.body ? `<blockquote>${escape(item.body)}</blockquote>` : ""}
${item.photoUrl ? `<p><img src="${escape(item.photoUrl)}" alt="The post's photo"></p>` : ""}
<form method="post" action="/api/mod/remove?type=${ok.target}&amp;id=${ok.id}&amp;sig=${escape(ok.sig)}"><button type="submit">Remove it</button></form>
<p>This deletes it for everyone${ok.target === "post" ? ", with its comments, votes and photo" : ", with its replies and votes"}. It can't be undone.</p>`,
  );
}

export async function POST(request: Request) {
  if (!dbEnabled()) return page("Unavailable", "<p>The database isn't connected.</p>", 503);
  const ok = check(request);
  if (!ok) return page("Link not valid", "<p>This removal link isn't valid.</p>", 403);
  try {
    const item = await getForReview(ok.target, ok.id);
    const removed = await removeAsOwner(ok.target, ok.id);
    if (removed) await captureServer("removed_by_owner", { target: ok.target, what: item?.what ?? null, was_hidden_by_ai: !!item?.hiddenByAi });
    return removed
      ? page("Removed", `<p>The ${ok.target} has been deleted.</p>`)
      : page("Already gone", `<p>This ${ok.target} had already been deleted.</p>`);
  } catch (e) {
    console.error("mod remove failed:", e);
    return page("Something went wrong", `<p>The ${ok.target} couldn't be removed. Try again in a minute.</p>`, 503);
  }
}
