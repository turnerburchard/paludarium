import { useEffect, useRef, useState } from "react";
import type { World } from "../model/schema";
import { createWorldEcosystem, feedingStations } from "./worldHabitat";
import type { Ecosystem } from "./engine";

/** React is a consumer of the engine; it receives HUD snapshots four times a second. */
export function useEcosystem(world: World) {
  const live = useRef<{ world: World; engine: Ecosystem } | null>(null);
  if (!live.current)
    live.current = { world, engine: createWorldEcosystem(world) };
  const [snapshot, setSnapshot] = useState(() =>
    live.current!.engine.snapshot(),
  );
  useEffect(() => {
    const previous = live.current!;
    if (previous.world === world) return;
    // Brand new preset/import IDs mean a fresh habitat. Normal edits retain live needs.
    const sharesAnimals = world.objects.some((o) =>
      previous.world.objects.some((p) => p.id === o.id),
    );
    live.current = {
      world,
      engine: createWorldEcosystem(world, sharesAnimals ? previous : undefined),
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
  const refresh = () => setSnapshot(live.current!.engine.snapshot());
  return {
    live,
    snapshot,
    feed: () => {
      const engine = live.current!.engine;
      for (const node of feedingStations(engine.graph))
        engine.addFood(node.id, 3);
      refresh();
    },
    mist: () => {
      live.current!.engine.mist();
      refresh();
    },
  };
}
export type EcosystemController = ReturnType<typeof useEcosystem>;
