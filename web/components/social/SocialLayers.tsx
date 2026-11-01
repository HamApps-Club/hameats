"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useLayers } from "@/lib/layers";
import { hallBySlug } from "@/lib/halls";
import { ItemSheet } from "@/components/ItemSheet";
import { Composer } from "@/components/social/Composer";
import { PostThread } from "@/components/social/PostThread";
import { ProfileScreen } from "@/components/social/Profile";
import { SettingsScreen } from "@/components/social/SettingsScreen";

type Layer =
  | { kind: "post"; id: number }
  | { kind: "profile"; username: string }
  | { kind: "dish"; dish: string; hall: string | null }
  | { kind: "compose" }
  | { kind: "settings" };

type Open = {
  post: (id: number) => void;
  profile: (username: string) => void;
  dish: (dish: string, hall: string | null) => void;
  compose: () => void;
  settings: () => void;
};

const OpenContext = createContext<Open>({ post: () => {}, profile: () => {}, dish: () => {}, compose: () => {}, settings: () => {} });

/** Opens a post, a profile, a dish's reviews, the new-post page or Settings on top of whatever is showing. */
export const useOpen = () => useContext(OpenContext);

/** Holds the pages opened on top of the Feed and profiles, so each can open the next (a post, then its writer's profile). */
export function SocialLayers({ children }: { children: ReactNode }) {
  const { stack, push, pop } = useLayers<Layer>();

  const open = useMemo<Open>(
    () => ({
      post: (id) => push({ kind: "post", id }),
      profile: (username) => push({ kind: "profile", username }),
      dish: (dish, hall) => push({ kind: "dish", dish, hall }),
      compose: () => push({ kind: "compose" }),
      settings: () => push({ kind: "settings" }),
    }),
    [push],
  );

  // Escape closes the top page only. A dish's page closes itself on Escape (ItemSheet), so it's left to do that.
  const top = stack[stack.length - 1];
  useEffect(() => {
    if (!top || top.kind === "dish") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && pop();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [top, pop]);

  return (
    <OpenContext.Provider value={open}>
      {children}
      {stack.map((layer, i) => {
        const key = `${i}-${layer.kind}`;
        switch (layer.kind) {
          case "post":
            return <PostThread key={key} id={layer.id} onClose={pop} />;
          case "profile":
            return <ProfileScreen key={key} username={layer.username} onClose={pop} />;
          case "dish":
            return (
              <ItemSheet
                key={key}
                item={{ name: layer.dish, calories: null, tags: [] }}
                context={(layer.hall && hallBySlug(layer.hall)?.name) || "Reviews"}
                place={layer.hall ? { hall: layer.hall, date: null, meal: null } : undefined}
                onClose={pop}
              />
            );
          case "compose":
            return <Composer key={key} onClose={pop} />;
          case "settings":
            return <SettingsScreen key={key} onClose={pop} />;
        }
      })}
    </OpenContext.Provider>
  );
}
