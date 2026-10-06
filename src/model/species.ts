import type { AssetKind } from "./schema";
export const frogKinds = [
  "tree-frog",
  "dart-frog",
  "blue-dart-frog",
  "mossy-frog",
] as const;
export type FrogKind = (typeof frogKinds)[number];
export function isFrogKind(kind: AssetKind): kind is FrogKind {
  return (frogKinds as readonly string[]).includes(kind);
}
