import type { World } from "../model/schema";
import { MAX_WORLD_SIZE, parseWorld } from "./persistence";

const PREFIX = "#world=1.";
const MAX_LINK_SIZE = 80_000;

export function isWorldLink(hash: string) {
  return hash.startsWith("#world=");
}

/** Fragments keep the layout in the link, without uploading it to a server.
 * The life log stays behind, like the rest of the live activity. */
export async function createWorldLink(world: World, baseURL: string) {
  const { log: _log, ...layout } = world;
  const source = new TextEncoder().encode(JSON.stringify(layout));
  if (source.length > MAX_WORLD_SIZE) throw new Error("World is too large.");
  const compressed = new Uint8Array(
    await new Response(
      new Blob([source]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer(),
  );
  const token = btoa(
    Array.from(compressed, (byte) => String.fromCharCode(byte)).join(""),
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  if (token.length > MAX_LINK_SIZE) throw new Error("World link is too large.");
  const url = new URL(baseURL);
  url.hash = `${PREFIX.slice(1)}${token}`;
  return url.href;
}

export async function readWorldLink(hash: string): Promise<World> {
  if (!hash.startsWith(PREFIX)) throw new Error("Unsupported world link.");
  const token = hash.slice(PREFIX.length);
  if (!token || token.length > MAX_LINK_SIZE || !/^[\w-]+$/.test(token))
    throw new Error("Invalid world link.");
  const compressed = Uint8Array.from(
    atob(token.replaceAll("-", "+").replaceAll("_", "/")),
    (char) => char.charCodeAt(0),
  );
  const reader = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"))
    .getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_WORLD_SIZE) {
        await reader.cancel();
        throw new Error("World is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return parseWorld(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
