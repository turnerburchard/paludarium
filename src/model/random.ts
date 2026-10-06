/** Tiny seeded generator: asset silhouettes remain stable across saves and undo. */
export function randomFromSeed(seed: number) {
  let value = seed | 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) | 0;
    return (value >>> 0) / 4294967296;
  };
}
