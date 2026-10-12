/** The share server: keeps shared worlds so their links can be short. The
 * site itself is static files, which Cloudflare serves without this. */
import { worldSchema } from "../src/model/schema";
import { unpackWorld } from "../src/model/worldToken";

/** The parts of D1 and the rate limiter used here, so tests can stand in. */
export interface Env {
  DB: {
    prepare(query: string): {
      bind(...values: unknown[]): {
        first(): Promise<{ token: string } | null>;
        run(): Promise<unknown>;
      };
    };
  };
  SHARES: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

/** Well past the largest world the editor can make, once packed. */
const MAX_TOKEN_SIZE = 400_000;

export default { fetch: handle };

export async function handle(request: Request, env: Env) {
  const { pathname } = new URL(request.url);
  if (pathname === "/api/worlds" && request.method === "POST")
    return saveWorld(request, env);
  const id = pathname.match(/^\/api\/worlds\/([\w-]{12})$/)?.[1];
  if (id && request.method === "GET") return loadWorld(id, env);
  return new Response("Not found", { status: 404 });
}

async function saveWorld(request: Request, env: Env) {
  const visitor = request.headers.get("cf-connecting-ip") ?? "";
  if (!(await env.SHARES.limit({ key: visitor })).success)
    return new Response("Too many shares", { status: 429 });
  if (Number(request.headers.get("content-length")) > MAX_TOKEN_SIZE)
    return new Response("World is too large", { status: 413 });
  const token = await request.text();
  if (token.length > MAX_TOKEN_SIZE)
    return new Response("World is too large", { status: 413 });
  let text: string;
  try {
    text = await unpackWorld(token);
    if (!worldSchema.safeParse(JSON.parse(text)).success) throw new Error();
  } catch {
    return new Response("Not a world", { status: 400 });
  }
  const id = await worldId(text);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO worlds (id, token, created) VALUES (?, ?, ?)",
  )
    .bind(id, token, Date.now())
    .run();
  return Response.json({ id }, { status: 201 });
}

async function loadWorld(id: string, env: Env) {
  const row = await env.DB.prepare("SELECT token FROM worlds WHERE id = ?")
    .bind(id)
    .first();
  if (!row) return new Response("No such world", { status: 404 });
  // A link always names the same world, so it can be cached for good.
  return new Response(row.token, {
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}

/** Named by what it holds, so sharing the same world again gives the same
 * link rather than another copy. */
async function worldId(text: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return btoa(String.fromCharCode(...new Uint8Array(hash, 0, 9)))
    .replaceAll("+", "-")
    .replaceAll("/", "_");
}
