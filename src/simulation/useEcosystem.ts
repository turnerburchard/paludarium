import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { HabitatChanges } from "./habitatChanges";
import { isAnimal } from "../assets";
import type { HabitatObject, World } from "../model/schema";
import { objectBase } from "../model/stacking";
import { groundHeight, onlyAppearanceDiffers } from "../model/terrain";
import { createWorldEcosystemSteps, prepareHabitatEdit } from "./worldHabitat";
import { runInBatches } from "../work";
import type { Ecosystem } from "./engine";
import {
  advanceLife as evolveLife,
  breed,
  habitatSupport,
  readyToBreed,
  withAnimalPositions,
  withAnimalCourtships,
  youngAndParents,
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
  initial: { world: World; engine: Ecosystem },
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
  const opened = useRef(initial);
  if (!live.current || opened.current !== initial) {
    opened.current = initial;
    live.current = {
      world: initial.world,
      engine: initial.engine,
      lifeRemainder: 0,
    };
  }
  const [snapshotStore] = useState(() =>
    latestValue(live.current!.engine.snapshot()),
  );
  const [remains, setRemains] = useState<Remains[]>([]);
  const rebuilding = useRef<false | "local" | "full">(false);
  const [buildError, setBuildError] = useState<unknown>(null);
  if (buildError) throw buildError;
  const habitat = useMemo(() => habitatSupport(world), [world]);
  useEffect(() => {
    setRemains([]);
    snapshotStore.set(initial.engine.snapshot());
  }, [initial, snapshotStore]);
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
    const oldAnimals = previous.world.objects.filter((object) =>
      isAnimal(object.kind),
    );
    const newAnimals = world.objects.filter((object) => isAnimal(object.kind));
    const sameAnimals =
      oldAnimals.length === newAnimals.length &&
      oldAnimals.every((old, i) => {
        const next = newAnimals[i];
        return (
          old.id === next.id &&
          old.kind === next.kind &&
          old.x === next.x &&
          old.z === next.z &&
          old.rotation === next.rotation &&
          old.scale === next.scale &&
          old.seed === next.seed &&
          JSON.stringify(old.life) === JSON.stringify(next.life)
        );
      });
    const changes =
      sameAnimals && previous.world.environment !== world.environment
        ? HabitatChanges.between(previous.world, world)
        : undefined;
    if (changes) {
      rebuilding.current = "local";
      previous.engine.holdHabitat(changes);
      const cancel = runInBatches(
        prepareHabitatEdit(world, previous, changes),
        (publish) => {
          publish();
          previous.world = world;
          rebuilding.current = false;
          snapshotStore.set(previous.engine.snapshot());
        },
        (error) => {
          previous.engine.holdHabitat();
          rebuilding.current = false;
          setBuildError(error);
        },
      );
      return () => {
        cancel();
        previous.engine.holdHabitat();
        rebuilding.current = false;
      };
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
    rebuilding.current = "full";
    const cancel = runInBatches(
      createWorldEcosystemSteps(world, sharesAnimals ? previous : undefined),
      (engine) => {
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
        live.current = { world, engine, lifeRemainder: 0 };
        rebuilding.current = false;
        snapshotStore.set(engine.snapshot());
      },
      (error) => {
        rebuilding.current = false;
        setBuildError(error);
      },
    );
    return () => {
      cancel();
      rebuilding.current = false;
    };
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
    if (paused || rebuilding.current) return;
    current.lifeRemainder += Math.min(seconds, 0.25);
    // Save courtship every second; ordinary life can use a slower tick.
    const interval = current.engine.courtships.length ? 1 : 5;
    if (current.lifeRemainder < interval && !current.engine.meetings.length)
      return;
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
      evolveLife(
        withAnimalCourtships(placed, current.engine.courtships),
        current.lifeRemainder,
        stranded,
      ),
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
      // Keep the recorded live positions as the rebuild's base. React's
      // committed world starts the cancellable build, as it does for edits.
      current.world = placed;
      onLifeChange(previous, next);
      return;
    }
    current.engine.court(readyToBreed(next), [], () => false);
    current.engine.raise(youngAndParents(next));
    current.world = withAnimalCourtships(next, current.engine.courtships);
    onLifeChange(previous, current.world);
  }
  return {
    live,
    snapshotStore,
    rebuilding,
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
