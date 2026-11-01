import "server-only";
import { randomUUID } from "node:crypto";
import sharp, { type OutputInfo } from "sharp";
import { del, put } from "@vercel/blob";

/**
 * Photos are stored in Vercel Blob. They're switched on by connecting a Blob store to the project in Vercel (Storage,
 * then Create, then Blob), which sets BLOB_READ_WRITE_TOKEN; until then the app hides the photo buttons.
 */
export const photosEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;

/** The phone shrinks a photo before sending it; this is the most the server accepts. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
/** The longest side a stored photo can have. */
const MAX_SIDE = 1600;

/** What a file's first bytes say it is. The phone's word for it (the content type) isn't trusted. */
function sniff(bytes: Uint8Array): "jpeg" | "png" | "webp" | "heic" | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(4, 8) === "ftyp" && /^(heic|heix|hevc|mif1|msf1)$/.test(ascii(8, 12))) return "heic";
  return null;
}

export type StoredPhoto = { url: string; key: string; width: number; height: number; bytes: number };

export class PhotoError extends Error {}

/**
 * Re-draws the photo as a JPEG at most MAX_SIDE pixels on its longest side, turned the right way up, then stores it.
 * Re-drawing drops everything the camera wrote into the file, including where the photo was taken.
 */
export async function storePhoto(input: Uint8Array): Promise<StoredPhoto> {
  const kind = sniff(input);
  if (!kind) throw new PhotoError("That file isn't a photo HamEats can use. Try a JPEG or PNG.");
  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharp(input, { limitInputPixels: 80_000_000 })
      .rotate()
      .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new PhotoError(
      kind === "heic"
        ? "That photo is in Apple's HEIC format, which HamEats can't read yet. Try again from the camera or photo library button."
        : "That photo couldn't be read. Try a different one.",
    );
  }
  const key = `photos/${randomUUID()}.jpg`;
  const blob = await put(key, out.data, { access: "public", contentType: "image/jpeg", addRandomSuffix: false, cacheControlMaxAge: 31536000 });
  return { url: blob.url, key, width: out.info.width, height: out.info.height, bytes: out.info.size };
}

/** Removes stored photo files (after their post is deleted). Never throws: a leftover file is harmless. */
export async function removePhotos(keys: string[]) {
  if (!keys.length || !photosEnabled()) return;
  await del(keys).catch((e) => console.error("photo delete failed:", e));
}
