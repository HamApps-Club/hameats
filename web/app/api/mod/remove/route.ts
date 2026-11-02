import { idParam } from "@/lib/apiGuard";
import { dbEnabled } from "@/lib/db";
import { postForReview, removePostAsOwner, validRemoval } from "@/lib/moderation";

export const dynamic = "force-dynamic";

// The "Remove" link in each Discord message. Opening it only shows the post and a button (so a link preview can't
// remove anything); pressing the button removes it. Both need the signature from the Discord message.

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function page(title: string, inner: string, status = 200) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${escape(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:32px auto;padding:0 16px;line-height:1.5;color:#111;background:#fff}
img{max-width:100%;border-radius:8px}blockquote{white-space:pre-wrap;border-left:3px solid #ccc;margin:12px 0;padding-left:12px}
button{font:inherit;font-weight:600;padding:10px 18px;border:0;border-radius:8px;background:#c0392b;color:#fff;cursor:pointer}
@media (prefers-color-scheme:dark){body{color:#eee;background:#111}}</style></head><body><h1>${escape(title)}</h1>${inner}</body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

function check(request: Request) {
  const url = new URL(request.url);
  const id = idParam(url.searchParams.get("id"));
  const sig = url.searchParams.get("sig");
  return id && validRemoval(id, sig) ? { id, sig: sig! } : null;
}

export async function GET(request: Request) {
  if (!dbEnabled()) return page("Unavailable", "<p>The database isn't connected.</p>", 503);
  const ok = check(request);
  if (!ok) return page("Link not valid", "<p>This removal link isn't valid.</p>", 403);
  const post = await postForReview(ok.id);
  if (!post) return page("Already gone", "<p>This post has already been deleted.</p>", 404);
  const what = post.kind === "review" ? `Review of ${post.dish}` : "Post";
  return page(
    `Remove this ${post.kind}?`,
    `<p><strong>${escape(what)}</strong> by u/${escape(post.author)}</p>
${post.body ? `<blockquote>${escape(post.body)}</blockquote>` : ""}
${post.photoUrl ? `<p><img src="${escape(post.photoUrl)}" alt="The post's photo"></p>` : ""}
<form method="post" action="/api/mod/remove?id=${ok.id}&amp;sig=${escape(ok.sig)}"><button type="submit">Remove it</button></form>
<p>This deletes it for everyone, with its comments, votes and photo. It can't be undone.</p>`,
  );
}

export async function POST(request: Request) {
  if (!dbEnabled()) return page("Unavailable", "<p>The database isn't connected.</p>", 503);
  const ok = check(request);
  if (!ok) return page("Link not valid", "<p>This removal link isn't valid.</p>", 403);
  try {
    const removed = await removePostAsOwner(ok.id);
    return removed ? page("Removed", "<p>The post has been deleted.</p>") : page("Already gone", "<p>This post had already been deleted.</p>");
  } catch (e) {
    console.error("mod remove failed:", e);
    return page("Something went wrong", "<p>The post couldn't be removed. Try again in a minute.</p>", 503);
  }
}
