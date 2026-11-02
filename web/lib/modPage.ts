import "server-only";

// The small plain pages behind the Remove and Restore links in Discord messages.

export const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function page(title: string, inner: string, status = 200) {
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
