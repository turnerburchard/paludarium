import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasDismissedHelp,
  rememberHelpDismissal,
} from "../src/ui/helpPreference";

afterEach(() => vi.unstubAllGlobals());

describe("controls help preference", () => {
  it("remembers dismissal without touching saved worlds", () => {
    const values = new Map([["little-worlds:v4", "saved world"]]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    expect(hasDismissedHelp()).toBe(false);
    rememberHelpDismissal();
    expect(hasDismissedHelp()).toBe(true);
    expect(values.get("little-worlds:v4")).toBe("saved world");
  });

  it("still offers help when reading storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("Storage blocked");
      },
    });
    expect(hasDismissedHelp()).toBe(false);
  });

  it("does not interrupt dismissal when storage is full or blocked", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("Storage full");
      },
    });
    expect(rememberHelpDismissal).not.toThrow();
  });
});
