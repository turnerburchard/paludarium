import { useEffect, useRef, useState } from "react";
import { assets, isAnimal } from "../assets";
import type { HabitatObject, World } from "../model/schema";
import { objectBase } from "../model/stacking";
import { groundHeight, swimmingHeight } from "../model/terrain";
import { createFishSchool, createWorldEcosystem } from "./worldHabitat";
import type { Ecosystem } from "./engine";
import type { FishSchool } from "./fish";
import { advanceLife as evolveLife, habitatSupport } from "./lifeCycle";
import type { Vec3 } from "./types";

/** A dead animal's body, from where it was last seen until it has faded. */
export interface Remains {
  object: HabitatObject;
  position: Vec3;
  heading: number;
  /** Where the body comes to rest: the bottom for a fish, and the ground
   * for an animal that dies on a leaf or the glass. */
  restY: number;
}

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
  const [remains, setRemains] = useState<Remains[]>([]);
  useEffect(() => {
    const previous = live.current!;
    if (previous.world === world) return;
    // Brand new preset/import IDs mean a fresh habitat. Normal edits retain live needs.
    const sharesAnimals = world.objects.some(
      (o) =>
        isAnimal(o.kind) &&
        previous.world.objects.some((p) => p.id === o.id && p.kind === o.kind),
    );
    if (!sharesAnimals) setRemains([]);
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
  /** Whether the animal has anywhere it can live: ground it can walk, or
   * water it can swim. */
  function canLive(id: string) {
    const { engine, fish } = live.current!;
    return !!engine.observeAnimal(id) || !!fish.get(id);
  }
  /** Where the animal was last drawn, before the habitat forgets it. */
  function remainsOf(object: HabitatObject): Remains {
    const { engine, fish, world } = live.current!;
    const env = world.environment;
    const swimmer = fish.get(object.id);
    if (swimmer) {
      const { x, z } = swimmer;
      const depth = assets[object.kind].swims!.depth;
      return {
        object,
        position: { x, y: swimmer.y ?? swimmingHeight(x, z, env, depth), z },
        heading: swimmer.heading,
        restY: groundHeight(x, z, env),
      };
    }
    const animal = engine.observeRenderedAnimal(object.id);
    if (!animal) {
      const y = objectBase(object, env);
      return {
        object,
        position: { x: object.x, y, z: object.z },
        heading: object.rotation,
        restY: y,
      };
    }
    const { position, direction, surface } = animal;
    const falls =
      animal.grounded ||
      surface === "leaf" ||
      surface === "stem" ||
      surface === "glass";
    return {
      object,
      position: { ...position },
      heading: Math.atan2(-direction.x, -direction.z),
      restY: falls ? groundHeight(position.x, position.z, env) : position.y,
    };
  }
  function advanceLife(seconds: number, paused: boolean) {
    const current = live.current!;
    if (paused) return;
    current.lifeRemainder += Math.min(seconds, 0.25);
    if (current.lifeRemainder < 5) return;
    const stranded = new Set(
      current.world.objects
        .filter((o) => isAnimal(o.kind) && !canLive(o.id))
        .map((o) => o.id),
    );
    const next = evolveLife(
      current.world,
      current.lifeRemainder,
      Math.random,
      stranded,
    );
    current.lifeRemainder = 0;
    if (next === current.world) return;
    const previous = current.world;
    const populationChanged =
      next.objects.length !== previous.objects.length ||
      next.objects.some((o, i) => o.id !== previous.objects[i]?.id);
    if (populationChanged) {
      const living = new Set(next.objects.map((o) => o.id));
      const died = previous.objects.filter(
        (o) => isAnimal(o.kind) && !living.has(o.id),
      );
      if (died.length) setRemains((r) => [...r, ...died.map(remainsOf)]);
      current.engine = createWorldEcosystem(next, current);
      current.fish = createFishSchool(next, current);
    }
    current.world = next;
    onLifeChange(previous, next);
  }
  return {
    live,
    snapshot,
    canLive,
    advanceLife,
    remains,
    /** A body that has finished fading. */
    forgetRemains: (id: string) =>
      setRemains((r) => r.filter((body) => body.object.id !== id)),
    habitat: habitatSupport(world),
  };
}
export type EcosystemController = ReturnType<typeof useEcosystem>;
