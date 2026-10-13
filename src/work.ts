/** Synchronous callers and batched callers run the same algorithm. */
export function finishWork<T>(steps: Generator<void, T>): T {
  let next = steps.next();
  while (!next.done) next = steps.next();
  return next.value;
}

/** Leave most of each frame for input, animation and drawing. */
export function runInBatches<T>(
  steps: Generator<void, T>,
  complete: (value: T) => void,
  failed: (error: unknown) => void,
) {
  let timer: ReturnType<typeof setTimeout>;
  function batch() {
    const deadline = performance.now() + 4;
    try {
      do {
        const next = steps.next();
        if (next.done) {
          complete(next.value);
          return;
        }
      } while (performance.now() < deadline);
      timer = setTimeout(batch, 0);
    } catch (error) {
      failed(error);
    }
  }
  timer = setTimeout(batch, 0);
  return () => {
    clearTimeout(timer);
  };
}
