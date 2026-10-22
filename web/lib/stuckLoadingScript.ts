/**
 * Plain inline script (no React, no app bundle), so it still runs when a phone's open copy of the app
 * can't load its code after a new deploy — the case where menus sit on the loading mark forever.
 * If the loading message (marked data-menu-loading in app/HomeClient.tsx) is still up after a few seconds,
 * a bar slides up from the bottom with a Refresh button. Refresh drops the service worker's cached
 * app files (saved menus in "data-v1" are kept), asks for the new service worker, and reloads.
 */
export const STUCK_LOADING_SCRIPT = `(() => {
  const FIRST_CHECK_MS = 8000, RECHECK_MS = 4000;
  const stuck = () => document.querySelector("[data-menu-loading]");

  async function refresh(button) {
    button.disabled = true;
    button.textContent = "Refreshing…";
    const timeout = new Promise((r) => setTimeout(r, 3000));
    const cleanup = (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k !== "data-v1").map((k) => caches.delete(k)));
      } catch {}
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        await reg?.update();
      } catch {}
    })();
    await Promise.race([cleanup, timeout]);
    location.reload();
  }

  function showBar() {
    const bar = document.createElement("div");
    bar.setAttribute("role", "alert");
    bar.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:50;display:flex;justify-content:center;" +
      "padding:12px 12px max(12px, env(safe-area-inset-bottom));transform:translateY(110%);" +
      "transition:transform .3s ease-out;font-family:system-ui,-apple-system,sans-serif";
    bar.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;width:100%;max-width:28rem;padding:14px 16px;' +
      'border-radius:16px;background:#18181b;color:#fff;box-shadow:0 10px 25px rgba(0,0,0,.3);font-size:15px">' +
      '<span style="flex:1">HamEats was updated. Tap Refresh to load the menus.</span>' +
      '<button type="button" style="flex:none;border:0;border-radius:10px;background:#2563eb;color:#fff;' +
      'font:inherit;font-weight:600;padding:10px 16px">Refresh</button></div>';
    const button = bar.querySelector("button");
    button.addEventListener("click", () => refresh(button));
    document.body.appendChild(bar);
    requestAnimationFrame(() => requestAnimationFrame(() => (bar.style.transform = "none")));
  }

  function check() {
    if (!stuck()) return;
    if (document.visibilityState === "visible") showBar();
    else setTimeout(check, RECHECK_MS);
  }
  setTimeout(check, FIRST_CHECK_MS);
})();`;
