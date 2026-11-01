"use client";

/** The longest side a photo is shrunk to before it's sent. The server shrinks it again if needed. */
const MAX_SIDE = 1600;

/**
 * Shrinks a photo from the camera or photo library to a JPEG of at most MAX_SIDE pixels, turned the right way up. A
 * phone photo of several megabytes becomes a few hundred kilobytes, so it uploads quickly on campus Wi-Fi and stays
 * under the server's size limit. Throws a message to show when the phone can't read the file.
 */
export async function shrinkPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") && file.type !== "") throw new Error("That file isn't a photo.");
  let bitmap: ImageBitmap;
  try {
    // "from-image" turns the picture by its EXIF orientation, so a photo taken sideways isn't saved sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That photo couldn't be opened. Try a different one, or take a new one.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("That photo couldn't be opened.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("That photo couldn't be prepared.");
  return blob;
}
