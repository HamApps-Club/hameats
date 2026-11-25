"use client";

/** Error codes meant for the app, not for people. Anything else the server says is already written to be shown. */
const TECHNICAL = new Set(["bad request", "not found", "forbidden", "login required", "unavailable"]);

/** A request to the app's API with a JSON body. Resolves to the parsed answer, or throws a message to show. */
export async function api<T = Record<string, unknown>>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  const data = res ? await res.json().catch(() => null) : null;
  if (!res?.ok)
    throw new Error(typeof data?.error === "string" && !TECHNICAL.has(data.error) ? data.error : "That didn't go through. Please try again.");
  return data as T;
}
