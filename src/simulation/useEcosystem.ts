import { useEffect, useRef, useState } from "react";
import { isAnimal } from "../assets";
import type { World } from "../model/schema";
import { createFishSchool, createWorldEcosystem } from "./worldHabitat";
import type { Ecosystem } from "./engine";
import type { FishSchool } from "./fish";
import { advanceLife as evolveLife, habitatSupport } from "./lifeCycle";

/** React is a consumer of the engine; it receives HUD snapshots four times a second. */
export function useEcosystem(
  world: World,
  onLifeChange: (base: World, next: World) => void,
) {
  const live = useRef<{
    world: World;
    engine: Ecosystem;
    fish: FishSchool;
    lifeRemainder: number;
  } | null>(null);
  if (!live.current)
    live.current = {
      world,
      engine: createWorldEcosystem(world),
      fish: createFishSchool(world),
      lifeRemainder: 0,
    };
  const [snapshot, setSnapshot] = useState(() =>
    live.current!.engine.snapshot(),
  );
  useEffect(() => {
    const previous = live.current!;
    if (previous.world === world) return;
    // Brand new preset/import IDs mean a fresh habitat. Normal edits retain live needs.
    const sharesAnimals = world.objects.some(
      (o) =>
        isAnimal(o.kind) &&
        previous.world.objects.some((p) => p.id === o.id && p.kind === o.kind),
    );
    live.current = {
      world,
      engine: createWorldEcosystem(world, sharesAnimals ? previous : undefined),
      fish: createFishSchool(world, sharesAnimals ? previous : undefined),
      lifeRemainder: 0,
    };
    setSnapshot(live.current.engine.snapshot());
  }, [world]);
  useEffect(() => {
    const timer = setInterval(
      () => setSnapshot(live.current!.engine.snapshot()),
      250,
    );
    return () => clearInterval(timer);
  }, []);
  function advanceLife(seconds: number, paused: boolean) {
    const current = live.current!;
    if (paused) return;
    current.lifeRemainder += Math.min(seconds, 0.25);
    if (current.lifeRemainder < 5) return;
    const next = evolveLife(current.world, current.lifeRemainder);
    current.lifeRemainder = 0;
    if (next === current.world) return;
    const previous = current.world;
    const populationChanged =
      next.objects.length !== previous.objects.length ||
      next.objects.some((o, i) => o.id !== previous.objects[i]?.id);
    if (populationChanged) {
      current.engine = createWorldEcosystem(next, current);
      current.fish = createFishSchool(next, current);
    }
    current.world = next;
    onLifeChange(previous, next);
  }
  return { live, snapshot, advanceLife, habitat: habitatSupport(world) };
}
export type EcosystemController = ReturnType<typeof useEcosystem>;
