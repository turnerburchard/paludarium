import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";

const render = vi.hoisted(() => vi.fn());
vi.mock("three", async (original) => ({
  ...(await original<typeof THREE>()),
  WebGLRenderer: class {
    domElement = { toDataURL: () => "data:image/png;base64,preview" };
    setSize() {}
    setPixelRatio() {}
    setClearColor() {}
    render = render;
    dispose() {}
    forceContextLoss() {}
  },
}));

import { loadThumbnails } from "../src/scene/thumbnails";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("renders only requested kinds, caches previews, and skips cancelled batches", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  );
  const controller = new AbortController();
  const first = loadThumbnails(["fern"], controller.signal);
  await vi.runAllTimersAsync();
  expect(await first).toEqual({ fern: "data:image/png;base64,preview" });
  expect(render).toHaveBeenCalledTimes(1);
  await loadThumbnails(["fern"], controller.signal);
  expect(render).toHaveBeenCalledTimes(1);

  const cancelled = new AbortController();
  const second = loadThumbnails(["rock"], cancelled.signal);
  cancelled.abort();
  await vi.runAllTimersAsync();
  await second;
  expect(render).toHaveBeenCalledTimes(1);

  const third = loadThumbnails(["rock"], controller.signal);
  await vi.runAllTimersAsync();
  expect(await third).toEqual({ rock: "data:image/png;base64,preview" });
  expect(render).toHaveBeenCalledTimes(2);
});
