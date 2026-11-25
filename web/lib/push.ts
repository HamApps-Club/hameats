"use client";

/**
 * Push notifications in the browser. On an iPhone they only work once HamEats is on the Home Screen (iOS 16.4 or
 * later), and every phone asks the person first, in its own words; a site may only ask in answer to a tap.
 */
export type PushSupport = "ok" | "needs-home-screen" | "unsupported";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (isIos && !standalone) return "needs-home-screen";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return "ok";
}

export const pushPermission = (): NotificationPermission | "unsupported" =>
  typeof Notification === "undefined" ? "unsupported" : Notification.permission;

const fromBase64Url = (key: string) => {
  const raw = atob((key + "=".repeat((4 - (key.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export type EnableResult =
  | { result: "on"; push: { endpoint: string; keys: { p256dh: string; auth: string } } }
  | { result: "denied" | "dismissed" | "failed" };

/**
 * Asks the phone for permission (it shows its own "Allow notifications?" message), then signs this phone up and
 * returns its push address, for the server to send alerts to. Must be called straight from a tap.
 */
export async function enablePush(publicKey: string): Promise<EnableResult> {
  const permission = await Notification.requestPermission();
  if (permission === "denied") return { result: "denied" };
  if (permission !== "granted") return { result: "dismissed" };
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(publicKey) }));
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return { result: "failed" };
    return { result: "on", push: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } } };
  } catch {
    return { result: "failed" };
  }
}

/** Stops notifications to this phone (the server forgets its address when notifications are turned off). */
export async function disablePush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    await subscription?.unsubscribe();
  } catch {}
}
