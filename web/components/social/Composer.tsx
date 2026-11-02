"use client";

import { useEffect, useRef, useState } from "react";
import { HALLS, HALL_SHORT } from "@/lib/halls";
import { useMe } from "@/lib/me";
import { shrinkPhoto } from "@/lib/imageResize";
import { track } from "@/lib/analytics";
import { CameraIcon, CloseIcon, LibraryIcon, Screen, announceFeedChange, api, messageFrom } from "@/components/social/bits";

const MAX_POST = 500;

type PhotoState =
  | { step: "none" }
  | { step: "working"; preview: string }
  | { step: "ready"; preview: string; id: number }
  | { step: "failed"; message: string };

/**
 * A new post, laid out like Reddit's: close and Post at the top, your username, an optional dining hall flair, the
 * words, and a photo from the camera or the photo library. No dish is chosen here: reviews are written from the Menu.
 *
 * The camera and library buttons are ordinary file pickers. The phone itself asks for permission the first time
 * ("Allow HamEats to use the camera?"), and it lets people pick one photo from the library without giving the site
 * the rest of it.
 */
export function Composer({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const [text, setText] = useState("");
  const [flair, setFlair] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [photo, setPhoto] = useState<PhotoState>({ step: "none" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cameraHint, setCameraHint] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const previewUrl = photo.step === "working" || photo.step === "ready" ? photo.preview : null;

  // The preview is a local copy of the photo; it's let go once it's no longer shown.
  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl]);

  // If the camera is closed without a photo, the reason may be that camera access is off: say where to turn it on.
  useEffect(() => {
    const input = camera.current;
    if (!input) return;
    const onCancel = () => setCameraHint(true);
    input.addEventListener("cancel", onCancel);
    return () => input.removeEventListener("cancel", onCancel);
  }, []);

  const choose = async (file: File | undefined, source: "camera" | "library") => {
    if (!file) return;
    setCameraHint(false);
    setError("");
    let blob: Blob;
    try {
      blob = await shrinkPhoto(file);
    } catch (e) {
      return setPhoto({ step: "failed", message: (e as Error).message });
    }
    const preview = URL.createObjectURL(blob);
    setPhoto({ step: "working", preview });
    track("photo_chosen", { source });
    const res = await fetch("/api/photos", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    if (!res?.ok || typeof data?.id !== "number") {
      track("photo_upload_failed", { source, status: res?.status ?? 0 });
      URL.revokeObjectURL(preview);
      return setPhoto({ step: "failed", message: messageFrom(data, "That photo didn't upload. Please try again.") });
    }
    setPhoto({ step: "ready", preview, id: data.id });
  };

  const post = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/api/posts", "POST", { body: text.trim(), hall: flair, photoId: photo.step === "ready" ? photo.id : null });
      track("post_created", { has_photo: photo.step === "ready", has_flair: !!flair });
      announceFeedChange();
      onClose();
    } catch (e) {
      track("post_failed", { has_photo: photo.step === "ready" });
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const ready = !busy && photo.step !== "working" && (!!text.trim() || photo.step === "ready");

  return (
    <Screen
      label="New post"
      onClose={onClose}
      title={
        // Where Reddit asks for a community: the dining hall this post is about (optional).
        <div className="relative">
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={picking}
            className={`flex min-h-10 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold ${
              flair ? "border border-accent text-accent" : "bg-zinc-200/70 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
            }`}
          >
            {flair ? HALL_SHORT[flair] : "Dining hall"}
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="size-4">
              <path fillRule="evenodd" clipRule="evenodd" d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
          {picking && (
            <ul role="listbox" aria-label="Dining hall flair" className="absolute left-0 top-full z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-rule bg-surface py-1 shadow-xl">
              {[...HALLS.map((h) => [h.slug, h.name] as const), [null, "No dining hall"] as const].map(([slug, name]) => (
                <li key={slug ?? "none"}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={flair === slug}
                    onClick={() => {
                      setFlair(slug);
                      setPicking(false);
                    }}
                    className={`flex min-h-11 w-full items-center px-4 text-left text-base hover:bg-zinc-200/60 dark:hover:bg-zinc-800 ${flair === slug ? "font-semibold text-accent" : ""}`}
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      }
      actions={
        <button type="button" disabled={!ready} onClick={() => void post()} className="rounded-full bg-accent-fill px-5 py-2 text-base font-bold text-on-accent disabled:opacity-40">
          {busy ? "Posting…" : "Post"}
        </button>
      }
      footer={
        // The toolbar sits right above the keyboard while you type, like Reddit's.
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            {me.photos ? (
              <button
                type="button"
                onClick={() => {
                  // Close the keyboard first, so it doesn't cover the Take photo / Photo Library sheet.
                  (document.activeElement as HTMLElement | null)?.blur();
                  setSheet(true);
                }}
                aria-label="Add a photo" className="flex size-11 items-center justify-center rounded-full text-zinc-800 hover:bg-zinc-200/60 dark:text-zinc-200 dark:hover:bg-zinc-800">
                <LibraryIcon />
              </button>
            ) : (
              <span className="px-1 text-[13px] text-muted">Photos are coming soon.</span>
            )}
            <span className="ml-auto pr-1 text-xs tabular-nums text-muted">
              {text.length}/{MAX_POST}
            </span>
          </div>
          {cameraHint && (
            <p className="px-1 text-[13px] text-muted">
              No photo taken. If the camera didn&apos;t open, allow camera access for your browser (or for HamEats, if it&apos;s on your Home Screen) in your
              phone&apos;s Settings.
            </p>
          )}
          {/* capture opens the camera straight away; without it, the phone offers its photo library. */}
          <input ref={camera} type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden className="sr-only" onChange={(e) => void choose(e.target.files?.[0], "camera").finally(() => (e.target.value = ""))} />
          <input ref={library} type="file" accept="image/*" tabIndex={-1} aria-hidden className="sr-only" onChange={(e) => void choose(e.target.files?.[0], "library").finally(() => (e.target.value = ""))} />
        </div>
      }
    >
      <div className="px-4 pb-6 pt-3" onClick={() => picking && setPicking(false)}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_POST))}
          aria-label="Your post"
          placeholder="What's on your mind?"
          rows={6}
          autoFocus
          className="block w-full resize-none bg-transparent text-[18px] leading-snug outline-none placeholder:text-muted"
        />

        {previewUrl && (
          <div className="relative mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen photo */}
            <img src={previewUrl} alt="The photo you're adding" className="max-h-72 w-full rounded-xl border border-rule object-cover" />
            {photo.step === "working" && (
              <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 text-base font-semibold text-white">Uploading…</span>
            )}
            <button type="button" onClick={() => setPhoto({ step: "none" })} aria-label="Remove photo" className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-black/65 text-white">
              <CloseIcon className="size-5" />
            </button>
          </div>
        )}
        {photo.step === "failed" && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{photo.message}</p>}
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <p className="mt-6 text-xs text-muted">Posted as u/{me.username}. To review a dish, tap it on the Menu.</p>
      </div>

      {sheet && (
        // Like Reddit's: a sheet from the bottom with the two ways to add a photo.
        <div className="fixed inset-0 z-[60] flex items-end bg-black/40" onClick={() => setSheet(false)}>
          <div role="dialog" aria-modal="true" aria-label="Add a photo" onClick={(e) => e.stopPropagation()} className="w-full rounded-t-2xl bg-surface px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-xl">
            {(
              [
                ["Take photo", <CameraIcon key="c" />, camera],
                ["Photo Library", <LibraryIcon key="l" />, library],
              ] as const
            ).map(([label, icon, input]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setSheet(false);
                  input.current?.click();
                }}
                className="flex min-h-14 w-full items-center gap-4 rounded-xl px-4 text-left text-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </Screen>
  );
}
