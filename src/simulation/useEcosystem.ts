import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { isAnimal } from "../assets";
import type { HabitatObject, World } from "../model/schema";
import { objectBase } from "../model/stacking";
import { groundHeight, onlyAppearanceDiffers } from "../model/terrain";
import { createWorldEcosystem } from "./worldHabitat";
import type { Ecosystem } from "./engine";
import {
  advanceLife as evolveLife,
  breed,
  habitatSupport,
  readyToBreed,
  withAnimalPositions,
} from "./lifeCycle";
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

/** React is a consumer of the engine; it receives HUD snapshots four times a
 * second. Only the components that show them re-render, through
 * useEcosystemSnapshot, so the rest of the app and scene don't. */
export function useEcosystem(
  world: World,
  onLifeChange: (base: World, next: World) => void,
  /** Life is paused while sculpting, so the habitat rebuild, which takes a
   * noticeable moment, waits until the terrain tool closes rather than
   * following every stroke. */
  holding = false,
) {
  const live = useRef<{
    world: World;
    engine: Ecosystem;
    lifeRemainder: number;
  } | null>(null);
  if (!live.current)
    live.current = {
      world,
      engine: createWorldEcosystem(world),
      lifeRemainder: 0,
    };
  const [snapshotStore] = useState(() =>
    latestValue(live.current!.engine.snapshot()),
  );
  const [remains, setRemains] = useState<Remains[]>([]);
  const habitat = useMemo(() => habitatSupport(world), [world]);
  useEffect(() => {
    const previous = live.current!;
    if (holding || previous.world === world) return;
    if (
      onlyAppearanceDiffers(previous.world.environment, world.environment) &&
      previous.world.objects === world.objects
    ) {
      previous.world = world;
      return;
    }
    // Brand new preset/import IDs mean a fresh habitat. Normal edits retain live needs.
    const sharesAnimals = world.objects.some(
      (o) =>
        isAnimal(o.kind) &&
        previous.world.objects.some((p) => p.id === o.id && p.kind === o.kind),
    );
    // Editor deaths arrive through a committed world, rather than advanceLife.
    const deaths = (world.log ?? []).filter(
      (entry) =>
        world.environment === previous.world.environment &&
        entry.cause === "killed" &&
        !previous.world.log?.includes(entry),
    );
    const living = new Set(world.objects.map((o) => o.id));
    const died = previous.world.objects.filter(
      (o) => !living.has(o.id) && deaths.some((entry) => entry.kind === o.kind),
    );
    // Read the bodies now: the updater runs after the engine below has
    // forgotten them, which would put them back where they were placed.
    const bodies = died.map(remainsOf);
    if (bodies.length) setRemains((r) => [...r, ...bodies]);
    else if (
      !sharesAnimals &&
      world.environment !== previous.world.environment &&
      !world.objects.some((o) =>
        previous.world.objects.some((p) => p.id === o.id),
      )
    )
      setRemains([]);
    else setRemains((r) => r.filter((body) => !living.has(body.object.id)));
    live.current = {
      world,
      engine: createWorldEcosystem(world, sharesAnimals ? previous : undefined),
      lifeRemainder: 0,
    };
    live.current.engine.court(readyToBreed(world));
    snapshotStore.set(live.current.engine.snapshot());
  }, [world, holding, snapshotStore]);
  useEffect(() => {
    const timer = setInterval(() => {
      const next = live.current!.engine.snapshot();
      // Paused life keeps the same snapshot, so nothing re-renders.
      if (next.elapsed !== snapshotStore.get().elapsed) snapshotStore.set(next);
    }, 250);
    return () => clearInterval(timer);
  }, [snapshotStore]);
  /** Whether the animal has anywhere it can live: ground it can walk, or
   * water it can swim. */
  function canLive(id: string) {
    return !!live.current!.engine.observeAnimal(id);
  }
  /** Where the animal was last drawn, before the habitat forgets it. */
  function remainsOf(object: HabitatObject): Remains {
    const { engine, world } = live.current!;
    const env = world.environment;
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
    // The body as drawn, which can sit a little off the point it walks along.
    const { position, direction } = animal.pose ?? animal;
    const surface = animal.surface;
    const falls =
      animal.grounded ||
      surface === "water" ||
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
    // A pair that has just met has its juvenile straight away.
    if (current.lifeRemainder < 5 && !current.engine.meetings.length) return;
    const stranded = new Set(
      current.world.objects
        .filter((o) => isAnimal(o.kind) && !canLive(o.id))
        .map((o) => o.id),
    );
    // Recorded where the engine already has them, so the rebuild below
    // doesn't take the new spots for an edit and move anyone.
    const placed = withAnimalPositions(
      current.world,
      (id) => current.engine.observeAnimal(id)?.position,
    );
    const next = breed(
      evolveLife(placed, current.lifeRemainder, stranded),
      current.engine.takeMeetings(),
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
      const bodies = died.map(remainsOf);
      if (bodies.length) setRemains((r) => [...r, ...bodies]);
      current.engine = createWorldEcosystem(next, {
        ...current,
        world: placed,
      });
    }
    current.world = next;
    current.engine.court(readyToBreed(next));
    onLifeChange(previous, next);
  }
  return {
    live,
    snapshotStore,
    canLive,
    advanceLife,
    remains,
    /** A body that has finished fading. */
    forgetRemains: (id: string) =>
      setRemains((r) => r.filter((body) => body.object.id !== id)),
    habitat,
  };
}
export type EcosystemController = ReturnType<typeof useEcosystem>;

/** The engine's latest HUD snapshot, re-rendering the caller when it changes. */
export function useEcosystemSnapshot(ecosystem: EcosystemController) {
  const { subscribe, get } = ecosystem.snapshotStore;
  return useSyncExternalStore(subscribe, get);
}

/** A value that tells its subscribers when it changes, for useSyncExternalStore. */
function latestValue<T>(first: T) {
  let value = first;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
