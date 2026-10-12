import { assets } from "../assets";
import type { LogEntry } from "../model/schema";

/** A life event in a sentence, naming the animal by the name it was given,
 * if any. */
export function describe(
  { event, kind, cause }: LogEntry,
  name = assets[kind].name,
) {
  if (event === "born") return `${name} born.`;
  if (event === "grew-up") return `${name} grew up.`;
  if (event === "grew-old") return `${name} is getting old.`;
  if (cause === "age") return `${name} died of old age.`;
  if (cause === "starved") return `${name} died of starvation.`;
  if (cause === "crowded") return `${name} died of overcrowding.`;
  if (cause === "drowned") return `${name} drowned.`;
  if (cause === "stranded") return `${name} died out of water.`;
  if (cause === "killed") return `${name} was killed.`;
  return `${name} died.`;
}
