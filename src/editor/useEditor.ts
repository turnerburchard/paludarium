import { createObjectId } from "../model/objectId";
import { randomFromSeed } from "../model/random";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { assetRadius, isAnimal, placementScale } from "../assets";
import { killAnimal } from "../simulation/lifeCycle";
import {
  MAX_OBJECTS,
  MAX_SPRINGS,
  type AssetKind,
  type HabitatObject,
  type World,
  type Environment,
} from "../model/schema";
import {
  holdsUp,
  keepStacked,
  replaceObject,
  restingOn,
  type Surface,
} from "../model/stacking";
import { placementProblem } from "../model/water";
import {
  boundedPosition,
  fitObject,
  baseGroundHeight,
  groundHeight,
  onlyAppearanceDiffers,
} from "../model/terrain";
import {
  fitTerrain,
  terrainPoint,
  groundCeiling,
  waterCeiling,
} from "../model/terrainData";
import { historyReducer } from "./history";
import { TerrainStroke } from "./terrainStroke";
import type { TerrainBrush } from "../model/terrainBrush";
import { makePreset, type Preset } from "../model/presets";
import {
  prebuiltObjects,
  prebuiltProblem,
  type Prebuilt,
} from "../model/prebuilts";
import {
  activeEntry,
  loadLibrary,
  openLibraryWorld,
  parseLibrary,
  renameLibraryWorld,
  saveLibrary,
  STORAGE_KEY,
  type WorldLibrary,
} from "./persistence";
const newSeed = () => Math.floor(Math.random() * 2147483647);

/** Placing tools pick the seed up front, so the preview shows the very
 * shape that gets placed. */
export type Tool =
  | { type: "select" }
  | { type: "place"; kind: AssetKind; scale: number; seed: number }
  | { type: "prebuilt"; prebuilt: Prebuilt; seed: number }
  | { type: "move"; id: string }
  | { type: "copy"; id: string }
  | ({ type: "terrain" } & TerrainBrush)
  /** Adding a spring, or with an index, moving or changing that one. */
  | { type: "spring"; index: number | null };
export function useEditor(readOnly = false, sharedWorld?: World) {
  const [initial] = useState(loadLibrary);
  // The worlds as last saved, by this tab or another one.
  const [library, setLibrary] = useState(initial);
  // The world this tab has open. Each tab saves only its own world, so tabs
  // never write over each other's work.
  const [opened, setOpened] = useState(() => {
    const { id, preview } = activeEntry(initial);
    return { id, preview };
  });
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: activeEntry(initial).world,
    future: [],
  });
  const [isShared, setIsShared] = useState(!!sharedWorld);
  const [shared, setShared] = useState(sharedWorld);
  const world = isShared && shared ? shared : history.present;
  // A gesture previews only its original world; committing retires it.
  const [preview, setPreview] = useState<{ base: World; world: World } | null>(
    null,
  );
  const shown = preview?.base === world ? preview.world : world;
  const stroke = useRef<TerrainStroke | null>(null);
  const [tool, setTool] = useState<Tool>({ type: "select" });
  const [chosenId, select] = useState<string | null>(null);
  const [placementError, setPlacementError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [placementRotation, setPlacementRotation] = useState(0);
  const worldRef = useRef(world);
  worldRef.current = world;
  const libraryRef = useRef(library);
  libraryRef.current = library;
  /** The worlds as this tab would save them, with its own world first. */
  const current = openLibraryWorld(library, {
    ...opened,
    world: history.present,
  });
  // Undo can take away the selected object.
  const selected = world.objects.find((o) => o.id === chosenId) ?? null;
  const selectedId = selected?.id ?? null;
  const commit = useCallback((next: World) => {
    setPreview(null);
    if (JSON.stringify(next) === JSON.stringify(worldRef.current)) return;
    setOpened(({ id }) => ({ id, preview: undefined }));
    dispatch({ type: "commit", world: next });
  }, []);
  const updateLife = useCallback(
    (base: World, next: World) => {
      if (isShared) {
        setShared((current) => (current === base ? next : current));
        return;
      }
      dispatch({ type: "simulate", base, world: next });
    },
    [isShared],
  );
  useEffect(() => {
    if (isShared) return;
    setSaving(true);
    const persist = () => {
      const saved = saveLibrary(
        openLibraryWorld(libraryRef.current, {
          ...opened,
          world: history.present,
        }),
      );
      setSaved(saved);
      setSaveError(
        saved
          ? ""
          : "Your worlds could not be saved. Export a backup with Share before continuing.",
      );
      setSaving(false);
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") persist();
    };
    const timer = setTimeout(persist, 250);
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [history.present, isShared, opened]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      let next: WorldLibrary;
      try {
        next = parseLibrary(event.newValue);
      } catch {
        return;
      }
      setLibrary(next);
      // A tab in the background takes up changes made to its world in
      // another one, so coming back to it doesn't undo them.
      const mine = next.worlds.find((entry) => entry.id === opened.id);
      if (
        document.hidden &&
        mine &&
        !isShared &&
        JSON.stringify(mine.world) !== JSON.stringify(history.present)
      )
        show(mine);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [history.present, isShared, opened.id]);
  useEffect(() => {
    stroke.current = null;
    setPreview(null);
    setPlacementError("");
  }, [tool]);
  function cancelTerrainStroke() {
    stroke.current = null;
    setPreview(null);
  }
  const navigateHistory = useCallback((type: "undo" | "redo") => {
    setPreview(null);
    // An unfinished stroke is the current edit. Cancel it without also
    // stepping past the last committed edit.
    if (stroke.current) {
      stroke.current = null;
      return;
    }
    // Moving or copying an object, or changing a spring, that undo may take
    // away ends here.
    setTool((tool) =>
      tool.type === "move" || tool.type === "copy" || tool.type === "spring"
        ? { type: "select" }
        : tool,
    );
    setPlacementError("");
    dispatch({ type });
  }, []);
  function beginTerrainStroke(x: number, z: number) {
    if (tool.type !== "terrain") return;
    stroke.current = new TerrainStroke(history.present, tool);
    setPreview({
      base: stroke.current.original,
      world: stroke.current.dab(x, z),
    });
  }
  function continueTerrainStroke(x: number, z: number) {
    if (stroke.current)
      setPreview({
        base: stroke.current.original,
        world: stroke.current.dab(x, z),
      });
  }
  function endTerrainStroke() {
    const current = stroke.current;
    if (!current) return;
    stroke.current = null;
    commit(current.current);
  }
  const patchObject = useCallback(
    (id: string, patch: Partial<HabitatObject>) => {
      commit(withObjectPatch(worldRef.current, id, patch));
    },
    [commit],
  );
  const remove = useCallback(() => {
    if (!selectedId) return;
    const current = worldRef.current;
    const object = current.objects.find((o) => o.id === selectedId);
    const animal = object && isAnimal(object.kind);
    commit(
      animal
        ? killAnimal(current, selectedId)
        : {
            ...current,
            objects: replaceObject(
              current.objects,
              current.environment,
              selectedId,
            ),
          },
    );
    select(null);
    setTool({ type: "select" });
  }, [commit, selectedId]);
  const rotate = useCallback(
    (amount = Math.PI / 6) => {
      if (tool.type === "terrain" || tool.type === "spring") return;
      if (tool.type !== "select")
        setPlacementRotation((r) => (r + amount) % (Math.PI * 2));
      else if (selectedId) {
        const o = worldRef.current.objects.find((o) => o.id === selectedId);
        if (o)
          patchObject(o.id, {
            rotation: (o.rotation + amount) % (Math.PI * 2),
          });
      }
    },
    [tool, selectedId, patchObject],
  );
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      // An open dialog owns the keyboard; the world behind it stays as it is.
      if (
        target?.closest("input,textarea,select,[contenteditable=true]") ||
        document.querySelector('[role="dialog"]')
      )
        return;
      if (readOnly) {
        if (e.key === "Escape") select(null);
        else if (e.code === "Space" && !target?.closest("button,a,summary")) {
          e.preventDefault();
          setPaused((p) => !p);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        navigateHistory(e.shiftKey ? "redo" : "undo");
      } else if (e.key === "Escape") {
        finish();
        select(null);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      } else if (
        e.key.toLowerCase() === "r" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      )
        rotate(e.shiftKey ? -Math.PI / 6 : Math.PI / 6);
      // Space on a focused control presses it; elsewhere it pauses life.
      else if (e.code === "Space" && !target?.closest("button,a,summary")) {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [remove, rotate, navigateHistory, readOnly]);
  /** Leaves placing or moving and discards unfinished terrain edits. */
  function finish() {
    cancelTerrainStroke();
    setTool({ type: "select" });
  }
  function choose(kind: AssetKind) {
    setTool({
      type: "place",
      kind,
      scale: placementScale(kind),
      seed: newSeed(),
    });
    select(null);
    setPlacementRotation(0);
  }
  function choosePrebuilt(prebuilt: Prebuilt) {
    setTool({ type: "prebuilt", prebuilt, seed: newSeed() });
    select(null);
    setPlacementRotation(0);
  }
  /** Places the tool's object at a spot on the ground, or on top of a stone
   * or wood piece when `surface` names one and the height of the spot. */
  function placeAt(x: number, z: number, surface?: Surface) {
    if (tool.type === "prebuilt") {
      placePrebuilt(tool.prebuilt, tool.seed, x, z);
      return;
    }
    const moving =
      tool.type === "move" || tool.type === "copy"
        ? world.objects.find((o) => o.id === tool.id)
        : null;
    const kind = tool.type === "place" ? tool.kind : moving?.kind;
    const seed = tool.type === "place" ? tool.seed : moving?.seed;
    if (!kind || seed === undefined) return;
    const scale = tool.type === "place" ? tool.scale : (moving?.scale ?? 1);
    const position = boundedPosition(
      x,
      z,
      world.environment,
      assetRadius(kind) * scale,
    );
    const resting = restingOn(
      surface,
      position.x,
      position.z,
      world.environment,
    );
    if (
      moving &&
      tool.type === "move" &&
      resting.support &&
      holdsUp(world.objects, moving.id, resting.support)
    ) {
      setPlacementError("It can't rest on something that's sitting on it.");
      return;
    }
    const problem = placementProblem(
      kind,
      position.x,
      position.z,
      world.environment,
      resting.lift,
    );
    if (problem) {
      setPlacementError(problem);
      return;
    }
    if (moving && tool.type === "move") {
      patchObject(moving.id, {
        ...position,
        ...resting,
        rotation: placementRotation,
      });
      setTool({ type: "select" });
      return;
    }
    if (world.objects.length >= MAX_OBJECTS) {
      setPlacementError("This world is full. Remove an object to make room.");
      return;
    }
    const object: HabitatObject = {
      id: createObjectId(),
      kind,
      ...position,
      ...(resting.support && resting),
      rotation: placementRotation,
      scale,
      seed,
      ...(moving?.moss && { moss: moving.moss }),
    };
    commit({ ...world, objects: [...world.objects, object] });
    if (tool.type === "copy") {
      select(object.id);
      setTool({ type: "select" });
    }
    if (tool.type === "place")
      setTool({ ...tool, scale: placementScale(kind), seed: newSeed() });
  }
  /** Adds every piece of a prebuilt at once, so one undo takes it away. */
  function placePrebuilt(
    prebuilt: Prebuilt,
    seed: number,
    x: number,
    z: number,
  ) {
    const position = boundedPosition(x, z, world.environment, prebuilt.radius);
    const pieces = prebuiltObjects(
      prebuilt,
      position.x,
      position.z,
      placementRotation,
      world.environment,
      randomFromSeed(seed),
    );
    const problem = prebuiltProblem(pieces, world.environment);
    if (problem) {
      setPlacementError(problem);
      return;
    }
    if (world.objects.length + pieces.length > MAX_OBJECTS) {
      setPlacementError("This world is full. Remove an object to make room.");
      return;
    }
    commit({ ...world, objects: [...world.objects, ...pieces] });
    setTool({ type: "prebuilt", prebuilt, seed: newSeed() });
  }
  /** Adds a spring where the ground is tapped, or moves the chosen one
   * there. */
  function placeSpring(x: number, z: number) {
    if (tool.type !== "spring") return;
    const env = world.environment;
    if (groundHeight(x, z, env) < env.water) {
      setPlacementError("Put the spring on ground above the water.");
      return;
    }
    const springs = [...env.springs];
    const at = {
      x: Math.min(0.5, Math.max(-0.5, x / env.width)),
      z: Math.min(0.5, Math.max(-0.5, z / env.depth)),
    };
    if (tool.index === null) {
      if (springs.length >= MAX_SPRINGS) {
        setPlacementError(`A tank can hold ${MAX_SPRINGS} springs.`);
        return;
      }
      springs.push({ ...at, flow: 0.5 });
      setTool({ type: "spring", index: springs.length - 1 });
    } else springs[tool.index] = { ...springs[tool.index], ...at };
    setPlacementError("");
    changeEnvironment({ springs });
  }
  function removeSpring(index: number) {
    changeEnvironment({
      springs: world.environment.springs.filter((_, i) => i !== index),
    });
    setTool({ type: "select" });
  }
  function changeEnvironment(patch: Partial<Environment>) {
    commit(withEnvironment(world, patch));
  }
  function rename(name: string) {
    if (name !== world.name) commit({ ...world, name });
  }
  function renameWorld(id: string, name: string): boolean {
    if (id === opened.id && !isShared) {
      rename(name);
      return true;
    }
    const next = renameLibraryWorld(current, id, name);
    if (!saveLibrary(next)) {
      setSaved(false);
      setSaveError("Your worlds could not be saved.");
      return false;
    }
    setLibrary(next);
    return true;
  }
  function switchLibrary(next: WorldLibrary): boolean {
    if (!saveLibrary(next)) {
      setSaved(false);
      setSaveError(
        "Your worlds could not be saved. Export a backup with Share before continuing.",
      );
      return false;
    }
    setLibrary(next);
    show(activeEntry(next));
    setIsShared(false);
    setSaved(true);
    setSaveError("");
    return true;
  }
  function show({ id, world, preview }: WorldLibrary["worlds"][number]) {
    dispatch({ type: "open", world });
    setOpened({ id, preview });
    select(null);
    setTool({ type: "select" });
    setPreview(null);
    stroke.current = null;
  }
  function createWorld(next: World): boolean {
    return switchLibrary(
      openLibraryWorld(current, { id: createObjectId(), world: next }),
    );
  }
  function startPreset(preset: Preset): boolean {
    return switchLibrary(
      openLibraryWorld(current, {
        id: createObjectId(),
        world: makePreset(preset),
        preview: true,
      }),
    );
  }
  function openWorld(id: string): boolean {
    if (id === opened.id && !isShared) return true;
    return switchLibrary(
      openLibraryWorld(
        current,
        current.worlds.find((entry) => entry.id === id)!,
      ),
    );
  }
  function deleteWorld(id: string): boolean {
    const worlds = current.worlds.filter((entry) => entry.id !== id);
    if (!worlds.length) return false;
    const next = {
      ...current,
      activeId: current.activeId === id ? worlds[0].id : current.activeId,
      worlds,
    };
    if (id === current.activeId && !isShared) return switchLibrary(next);
    if (!saveLibrary(next)) {
      setSaved(false);
      setSaveError("Your worlds could not be saved.");
      return false;
    }
    setLibrary(next);
    if (id === current.activeId) {
      const { world, preview } = activeEntry(next);
      dispatch({ type: "open", world });
      setOpened({ id: next.activeId, preview });
    }
    return true;
  }
  function move() {
    if (!selected) return;
    setPlacementRotation(selected.rotation);
    setTool({ type: "move", id: selected.id });
  }
  function duplicate() {
    if (!selected || world.objects.length >= MAX_OBJECTS) return;
    setPlacementRotation(selected.rotation);
    setTool({ type: "copy", id: selected.id });
  }
  return {
    world: shown,
    isShared,
    updateLife,
    library: current,
    createWorld,
    startPreset,
    openWorld,
    deleteWorld,
    renameWorld,
    adoptSharedWorld: () => (shared ? createWorld(shared) : false),
    savedWorld: world,
    previewEnvironment: (patch: Partial<Environment>) =>
      setPreview({ base: world, world: withEnvironment(world, patch) }),
    previewObject: (id: string, patch: Partial<HabitatObject>) =>
      setPreview({ base: world, world: withObjectPatch(world, id, patch) }),
    beginTerrainStroke,
    continueTerrainStroke,
    endTerrainStroke,
    cancelTerrainStroke,
    tool,
    setTool,
    selected,
    selectedId,
    select,
    placementError,
    setPlacementError,
    saveError,
    saved,
    saving,
    paused,
    setPaused,
    placementRotation,
    choose,
    choosePrebuilt,
    finish,
    placeAt,
    placeSpring,
    removeSpring,
    changeEnvironment,
    patchObject,
    remove,
    rotate,
    duplicate,
    move,
    rename,
    undo: () => navigateHistory("undo"),
    redo: () => navigateHistory("redo"),
    canUndo: !!stroke.current || !!history.past.length,
    canRedo: !stroke.current && !!history.future.length,
  };
}
export type Editor = ReturnType<typeof useEditor>;

export function withEnvironment(
  world: World,
  patch: Partial<Environment>,
): World {
  const environment = { ...world.environment, ...patch };
  if (onlyAppearanceDiffers(world.environment, environment))
    return { ...world, environment };
  environment.water = Math.min(environment.water, waterCeiling(environment));
  if (environment.terrain)
    environment.terrain = fitTerrain(environment.terrain, environment);
  if (environment.height < world.environment.height && environment.terrain) {
    environment.terrain = {
      ...environment.terrain,
      heights: environment.terrain.heights.map((delta, index) => {
        const { x, z } = terrainPoint(index, environment);
        return Math.min(
          delta,
          groundCeiling(environment) - baseGroundHeight(x, z, environment),
        );
      }),
    };
  }
  // Stacked objects ride along with their supports into the new bounds.
  let objects = world.objects;
  for (const object of world.objects)
    if (!object.support)
      objects = replaceObject(
        objects,
        world.environment,
        object.id,
        fitObject(object, environment),
      );
  return {
    ...world,
    environment,
    // Keep collision geometry cached when fitting leaves an object unchanged.
    objects: keepStacked(objects, world.environment, environment).map(
      (object, i) => {
        const original = world.objects[i];
        return object.x === original.x &&
          object.z === original.z &&
          object.rotation === original.rotation &&
          object.lift === original.lift
          ? original
          : object;
      },
    ),
  };
}

function withObjectPatch(
  world: World,
  id: string,
  patch: Partial<HabitatObject>,
): World {
  const object = world.objects.find((o) => o.id === id);
  if (!object) return world;
  return {
    ...world,
    objects: replaceObject(
      world.objects,
      world.environment,
      id,
      fitObject({ ...object, ...patch }, world.environment),
    ),
  };
}
