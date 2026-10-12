import type { World } from "../model/schema";
import { packWorld, unpackWorld } from "../model/worldToken";
import { parseWorld } from "./persistence";

const PREFIX = "#world=1.";
const MAX_LINK_SIZE = 80_000;

export function isWorldLink(hash: string) {
  return hash.startsWith("#world=");
}

/** The life log stays behind, like the rest of the live activity. */
function layoutToken(world: World) {
  const { log: _log, ...layout } = world;
  return packWorld(JSON.stringify(layout));
}

/** Fragments keep the whole layout in the link, so it opens without the
 * share server, and the layout is never uploaded. */
export async function createWorldLink(world: World, baseURL: string) {
  const token = await layoutToken(world);
  if (token.length > MAX_LINK_SIZE) throw new Error("World link is too large.");
  const url = new URL(baseURL);
  url.hash = `${PREFIX.slice(1)}${token}`;
  return url.href;
}

export async function readWorldLink(hash: string): Promise<World> {
  if (!hash.startsWith(PREFIX)) throw new Error("Unsupported world link.");
  const token = hash.slice(PREFIX.length);
  if (token.length > MAX_LINK_SIZE) throw new Error("Invalid world link.");
  return parseWorld(await unpackWorld(token));
}

/** The world a short link names, from the page's query, if it has one. */
export function shortLinkId(search: string) {
  return new URLSearchParams(search).get("w");
}

/** Keeps the world on the share server and returns a link short enough for
 * any chat app. */
export async function createShortLink(
  world: World,
  baseURL: string,
  signal: AbortSignal,
) {
  const response = await fetch("/api/worlds", {
    method: "POST",
    body: await layoutToken(world),
    signal,
  });
  if (!response.ok) throw new Error("The share server didn't keep the world.");
  const { id }: { id: string } = await response.json();
  const url = new URL(baseURL);
  url.searchParams.set("w", id);
  return url.href;
}

export async function readShortLink(id: string): Promise<World> {
  const response = await fetch(`/api/worlds/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error("This world link has no world.");
  return parseWorld(await unpackWorld(await response.text()));
}
