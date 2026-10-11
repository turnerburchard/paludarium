import { afterEach } from "vitest";

// The simulation tests run synchronously, so a worker busy with one file never
// reads Vitest's replies to its progress reports. Past a minute it gives up
// with "Timeout calling onTaskUpdate", though every test passes. Yielding a
// task between tests lets those replies through.
afterEach(() => new Promise((resolve) => setTimeout(resolve)));
