import { PHOTO_DAILY_LIMIT, photosToday, recordPhoto } from "@/lib/social";
import { MAX_UPLOAD_BYTES, PhotoError, photosEnabled, storePhoto } from "@/lib/photos";
import { reply, unavailable, writer } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/**
 * The photo itself as the request body (the phone has already shrunk it). It's re-drawn, stored, and its id comes
 * back, ready to attach to a post. Not shown anywhere until that post is saved.
 */
export async function POST(request: Request) {
  const user = await writer(request);
  if (user instanceof Response) return user;
  if (!photosEnabled()) return reply({ error: "Photos aren't turned on yet." }, 503);
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES) return reply({ error: "That photo is too big." }, 413);
  try {
    if ((await photosToday(user.id)) >= PHOTO_DAILY_LIMIT) return reply({ error: "You've added a lot of photos today. Try again tomorrow." }, 400);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length) return reply({ error: "bad request" }, 400);
    if (bytes.length > MAX_UPLOAD_BYTES) return reply({ error: "That photo is too big." }, 413);
    const stored = await storePhoto(bytes);
    const id = await recordPhoto(user.id, stored);
    return reply({ id, url: stored.url, width: stored.width, height: stored.height });
  } catch (e) {
    if (e instanceof PhotoError) return reply({ error: e.message }, 400);
    console.error("photos POST failed:", e);
    return unavailable();
  }
}
