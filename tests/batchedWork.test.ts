import { afterEach, expect, it, vi } from "vitest";
import { runInBatches } from "../src/work";

afterEach(() => vi.restoreAllMocks());

it("lets the browser run between batches and publishes only the completed result", async () => {
  let clock = 0;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  const visited: number[] = [];
  function* steps() {
    for (let i = 0; i < 6; i++) {
      visited.push(i);
      clock += 4;
      yield;
    }
    return "finished";
  }
  const complete = vi.fn();
  const failed = vi.fn();
  const cancel = runInBatches(steps(), complete, failed);
  expect(visited).toEqual([]);
  await new Promise((resolve) => setTimeout(resolve, 1));
  expect(visited).toEqual([0]);
  expect(complete).not.toHaveBeenCalled();
  cancel();
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(visited).toEqual([0]);
  expect(complete).not.toHaveBeenCalled();
  expect(failed).not.toHaveBeenCalled();
});

it("reports failures without publishing a partial result", async () => {
  const error = new Error("broken build");
  function* steps() {
    yield;
    throw error;
  }
  const complete = vi.fn();
  const failed = vi.fn();
  runInBatches(steps(), complete, failed);
  await vi.waitFor(() => expect(failed).toHaveBeenCalledWith(error));
  expect(complete).not.toHaveBeenCalled();
});
