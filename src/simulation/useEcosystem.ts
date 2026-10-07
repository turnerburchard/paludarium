import { useEffect, useRef, useState } from "react";
import { isAnimal } from "../assets";
import type { World } from "../model/schema";
import { createFishSchool, createWorldEcosystem } from "./worldHabitat";
import type { Ecosystem } from "./engine";
import type { FishSchool } from "./fish";

/** React is a consumer of the engine; it receives HUD snapshots four times a second. */
export function useEcosystem(world: World) {
  const live = useRef<{
    world: World;
    engine: Ecosystem;
    fish: FishSchool;
  } | null>(null);
  if (!live.current)
    live.current = {
      world,
      engine: createWorldEcosystem(world),
      fish: createFishSchool(world),
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
  return { live, snapshot };
}
export type EcosystemController = ReturnType<typeof useEcosystem>;
