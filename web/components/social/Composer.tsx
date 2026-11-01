"use client";

import { useEffect, useRef, useState } from "react";
import { HALLS, HALL_SHORT } from "@/lib/halls";
import { useMe } from "@/lib/me";
import { shrinkPhoto } from "@/lib/imageResize";
import { track } from "@/lib/analytics";
import { Avatar, CameraIcon, CloseIcon, LibraryIcon, Screen, announceFeedChange, api, messageFrom } from "@/components/social/bits";

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
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const ready = !busy && photo.step !== "working" && (!!text.trim() || photo.step === "ready");
  const toolButton = "flex min-h-11 items-center gap-2 rounded-full px-3 text-[15px] font-semibold text-accent hover:bg-accent/10";

  return (
    <Screen
      label="New post"
      onClose={onClose}
      title={<h2 className="font-display text-xl font-bold">New post</h2>}
      actions={
        <button type="button" disabled={!ready} onClick={() => void post()} className="rounded-full bg-accent-fill px-5 py-2 text-base font-bold text-on-accent disabled:opacity-40">
          {busy ? "Posting…" : "Post"}
        </button>
      }
      footer={
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            {me.photos ? (
              <>
                <button type="button" onClick={() => camera.current?.click()} className={toolButton}>
                  <CameraIcon />
                  Camera
                </button>
                <button type="button" onClick={() => library.current?.click()} className={toolButton}>
                  <LibraryIcon />
                  Library
                </button>
              </>
            ) : (
              <span className="px-1 text-[13px] text-muted">Photos are coming soon.</span>
            )}
            <span className="ml-auto text-xs tabular-nums text-muted">
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
      <div className="px-4 pb-6 pt-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={me.username ?? "?"} size="size-9" />
          <b className="text-base">u/{me.username}</b>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {flair ? (
            <button type="button" onClick={() => setFlair(null)} aria-label={`Remove the ${HALL_SHORT[flair]} flair`} className="flex items-center gap-1.5 rounded-full border border-accent px-3 py-1 text-sm font-semibold text-accent">
              {HALL_SHORT[flair]}
              <span aria-hidden>×</span>
            </button>
          ) : (
            <button type="button" onClick={() => setPicking((v) => !v)} aria-expanded={picking} className="flex items-center gap-1 rounded-full border border-rule px-3 py-1 text-sm font-semibold text-muted hover:border-accent/50">
              <span aria-hidden>+</span> Add flair
            </button>
          )}
        </div>
        {picking && !flair && (
          <div role="group" aria-label="Choose a dining hall flair" className="mt-2 flex flex-wrap gap-2">
            {HALLS.map((h) => (
              <button
                key={h.slug}
                type="button"
                onClick={() => {
                  setFlair(h.slug);
                  setPicking(false);
                }}
                className="rounded-full border border-accent px-3 py-1 text-sm font-semibold text-accent hover:bg-accent/10"
              >
                {HALL_SHORT[h.slug]}
              </button>
            ))}
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_POST))}
          aria-label="Your post"
          placeholder="What's on your mind?"
          rows={6}
          autoFocus
          className="mt-4 block w-full resize-none bg-transparent text-[18px] leading-snug outline-none placeholder:text-muted"
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
    </Screen>
  );
}
