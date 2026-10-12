/** Worlds travel in links as gzipped JSON in URL-safe base64. The browser
 * and the share server both pack and unpack them this way. */

/** Room for the largest world the editor can make: a full tank of animals on
 * the finest sculpted grid. */
export const MAX_WORLD_SIZE = 600_000;

export async function packWorld(text: string) {
  const source = new TextEncoder().encode(text);
  if (source.length > MAX_WORLD_SIZE) throw new Error("World is too large.");
  const compressed = new Uint8Array(
    await new Response(
      new Blob([source]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer(),
  );
  return btoa(
    Array.from(compressed, (byte) => String.fromCharCode(byte)).join(""),
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/** The JSON a token holds. Stops early when it unpacks past the size limit,
 * so a tiny token can't expand into a huge one. */
export async function unpackWorld(token: string) {
  if (!/^[\w-]+$/.test(token)) throw new Error("Invalid world link.");
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
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
