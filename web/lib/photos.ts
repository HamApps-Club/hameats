import "server-only";
import { del } from "@vercel/blob";

/**
 * Photos people posted in the old Feed are stored in Vercel Blob (BLOB_READ_WRITE_TOKEN). Nothing new is uploaded any
 * more; this only removes a person's files when they delete their account.
 */
export async function removePhotos(keys: string[]) {
  if (!keys.length || !process.env.BLOB_READ_WRITE_TOKEN) return;
  await del(keys).catch((e) => console.error("photo delete failed:", e));
}
