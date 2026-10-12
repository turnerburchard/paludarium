import { describe, expect, it } from "vitest";
import { handle, type Env } from "../worker";
import { makePreset } from "../src/model/presets";
import { emptyWorld } from "../src/model/schema";
import { packWorld } from "../src/model/worldToken";

/** D1 and the rate limiter, kept in memory. */
function server(allowed = true) {
  const rows = new Map<string, string>();
  const env: Env = {
    DB: {
      prepare: () => ({
        bind: (id, token) => ({
          run: async () => {
            if (!rows.has(String(id))) rows.set(String(id), String(token));
          },
          first: async () => {
            const token = rows.get(String(id));
            return token === undefined ? null : { token };
          },
        }),
      }),
    },
    SHARES: { limit: async () => ({ success: allowed }) },
  };
  const request = (path: string, body?: string) =>
    handle(
      new Request(`https://paludarium.test${path}`, {
        method: body === undefined ? "GET" : "POST",
        body,
      }),
      env,
    );
  return { rows, request };
}

describe("share server", () => {
  it("keeps a world and gives it back by its id", async () => {
    const { request } = server();
    const token = await packWorld(JSON.stringify(makePreset("tropical")));
    const saved = await request("/api/worlds", token);
    expect(saved.status).toBe(201);
    const { id } = await saved.json();
    expect(id).toMatch(/^[\w-]{12}$/);
    const loaded = await request(`/api/worlds/${id}`);
    expect(await loaded.text()).toBe(token);
  });

  it("names the same world the same way, keeping one copy", async () => {
    const { rows, request } = server();
    const token = await packWorld(JSON.stringify(emptyWorld()));
    const first = await (await request("/api/worlds", token)).json();
    const second = await (await request("/api/worlds", token)).json();
    expect(second.id).toBe(first.id);
    expect(rows.size).toBe(1);
  });

  it("turns away what isn't a world", async () => {
    const { rows, request } = server();
    for (const body of [
      "not a token!",
      await packWorld("not JSON"),
      await packWorld(JSON.stringify({ ...emptyWorld(), version: 99 })),
    ])
      expect((await request("/api/worlds", body)).status).toBe(400);
    expect(rows.size).toBe(0);
  });

  it("turns away oversized uploads and visitors sharing too fast", async () => {
    const token = await packWorld(JSON.stringify(emptyWorld()));
    expect(
      (await server().request("/api/worlds", "a".repeat(400_001))).status,
    ).toBe(413);
    expect((await server(false).request("/api/worlds", token)).status).toBe(
      429,
    );
  });

  it("answers unknown ids and other paths with not found", async () => {
    const { request } = server();
    expect((await request("/api/worlds/abcdefghijkl")).status).toBe(404);
    expect((await request("/api/worlds/../secrets")).status).toBe(404);
    expect((await request("/api/other")).status).toBe(404);
  });
});
