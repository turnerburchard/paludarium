import { useEffect, useState } from "react";
import type { World } from "../model/schema";
import { createShortLink, createWorldLink } from "../editor/worldLinks";
import { project } from "./project";

/** Builds the world's link ahead of the tap. Native sharing and copying need
 * the tap's user activation, which waiting on compression would spend.
 * Undefined while the link is being built, null when it can't be. */
export function useWorldLink(world: World) {
  const [prepared, setPrepared] = useState<{
    world: World;
    url: string | null;
  } | null>(null);
  useEffect(() => {
    let canceled = false;
    createWorldLink(world, project.url).then(
      (url) => {
        if (!canceled) setPrepared({ world, url });
      },
      () => {
        if (!canceled) setPrepared({ world, url: null });
      },
    );
    return () => {
      canceled = true;
    };
  }, [world]);
  return prepared?.world === world ? prepared.url : undefined;
}

const shortLinks = new WeakMap<World, Promise<string | null>>();

/** A short link for the world, or null when the share server can't keep it.
 * Asking again for the same world reuses the first answer. */
export function shortWorldLink(world: World) {
  let link = shortLinks.get(world);
  if (!link) {
    link = createShortLink(world, project.url, AbortSignal.timeout(4000)).catch(
      () => null,
    );
    shortLinks.set(world, link);
  }
  return link;
}

/** Opens the system share sheet. Resolves false when the browser has none or
 * it fails, so the caller can offer copying instead. */
export async function shareLink(worldName: string, url: string) {
  if (!navigator.share) return false;
  try {
    await navigator.share({ title: `${worldName} · Paludarium`, url });
  } catch (error) {
    return error instanceof DOMException && error.name === "AbortError";
  }
  return true;
}

/** Copies text, falling back to a selected field where the Clipboard API is
 * blocked, as in Firefox on iOS. Resolves false when neither works. */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    // 16px keeps iOS from zooming in on the field.
    field.style.cssText = "position:fixed;top:0;opacity:0;font-size:16px";
    const focused = document.activeElement;
    document.body.append(field);
    field.select();
    field.setSelectionRange(0, text.length);
    try {
      return document.execCommand("copy");
    } finally {
      field.remove();
      if (focused instanceof HTMLElement) focused.focus();
    }
  }
}
