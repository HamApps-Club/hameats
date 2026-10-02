// Served from a route (not public/) so the build ID can be written in: see the comment at the top of the script.
export const dynamic = "force-static";

const SCRIPT = `// HamEats service worker: makes the app load offline and keeps the last menus on the device.
// VERSION is the deploy's build ID, so every Vercel deploy is a new service worker: phones install it,
// and it drops the previous deploy's cached app files. Saved menus (DATA) are kept across deploys.
const VERSION = "__BUILD_ID__";
const SHELL = \`shell-\${VERSION}\`;
const DATA = "data-v1";
const PRECACHE = ["/", "/manifest.webmanifest", "/icons/icon-192.png?v=5", "/icons/icon-512.png?v=5"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Try the network; if it fails, use the last cached copy. */
async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(fallbackUrl ?? request, res.clone());
    return res;
  } catch {
    return (await cache.match(fallbackUrl ?? request)) ?? Response.error();
  }
}

/** Use the cached copy if there is one (hashed build files never change). */
async function cacheFirst(request) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // One-page app (halls live in the #hash), so every page is "/".
    event.respondWith(networkFirst(request, SHELL, "/"));
  } else if (url.pathname === "/api/menu" || url.pathname === "/dining_menu.json") {
    event.respondWith(networkFirst(request, DATA));
  } else if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
  }
});
`;

export function GET() {
  return new Response(SCRIPT.replace("__BUILD_ID__", process.env.BUILD_ID ?? "dev"), {
    headers: { "Content-Type": "application/javascript; charset=utf-8" },
  });
}
