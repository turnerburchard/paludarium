import { createObjectId } from "../model/objectId";
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
  activeWorld,
  loadLibrary,
  openLibraryWorld,
  saveLibrary,
  updateLibrary,
  type WorldLibrary,
} from "./persistence";
export type Tool =
  | { type: "select" }
  | { type: "place"; kind: AssetKind; scale: number }
  | { type: "prebuilt"; prebuilt: Prebuilt }
  | { type: "move"; id: string }
  | { type: "copy"; id: string }
  | ({ type: "terrain" } & TerrainBrush)
  /** Adding a spring, or with an index, moving or changing that one. */
  | { type: "spring"; index: number | null };
export function useEditor(readOnly = false, sharedWorld?: World) {
  const [initial] = useState(loadLibrary);
  const [library, setLibrary] = useState(initial.library);
  const initialWorld = activeWorld(initial.library);
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initialWorld,
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
  const [saveError, setSaveError] = useState(initial.warning ?? "");
  const [saved, setSaved] = useState(!initial.warning);
  const [saving, setSaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [placementRotation, setPlacementRotation] = useState(0);
  const worldRef = useRef(world);
  worldRef.current = world;
  // Undo can take away the selected object.
  const selected = world.objects.find((o) => o.id === chosenId) ?? null;
  const selectedId = selected?.id ?? null;
  const commit = useCallback((next: World) => {
    setPreview(null);
    if (JSON.stringify(next) === JSON.stringify(worldRef.current)) return;
    setLibrary((current) => updateLibrary(current, next, true));
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
    // An unreadable save stays in storage until the user starts over for real.
    if (isShared || (initial.warning && history.present === initialWorld))
      return;
    setSaving(true);
    const persist = () => {
      const saved = saveLibrary(updateLibrary(library, history.present));
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
  }, [history.present, isShared, initial, initialWorld, library]);
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
    setTool({ type: "place", kind, scale: placementScale(kind) });
    select(null);
    setPlacementRotation(0);
  }
  function choosePrebuilt(prebuilt: Prebuilt) {
    setTool({ type: "prebuilt", prebuilt });
    select(null);
    setPlacementRotation(0);
  }
  /** Places the tool's object at a spot on the ground, or on top of a stone
   * or wood piece when `surface` names one and the height of the spot. */
  function placeAt(x: number, z: number, surface?: Surface) {
    if (tool.type === "prebuilt") {
      placePrebuilt(tool.prebuilt, x, z);
      return;
    }
    const moving =
      tool.type === "move" || tool.type === "copy"
        ? world.objects.find((o) => o.id === tool.id)
        : null;
    const kind = tool.type === "place" ? tool.kind : moving?.kind;
    if (!kind) return;
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
      seed: moving?.seed ?? Math.floor(Math.random() * 2147483647),
      ...(moving?.moss && { moss: moving.moss }),
    };
    commit({ ...world, objects: [...world.objects, object] });
    if (tool.type === "copy") {
      select(object.id);
      setTool({ type: "select" });
    }
    if (tool.type === "place")
      setTool({ ...tool, scale: placementScale(kind) });
  }
  /** Adds every piece of a prebuilt at once, so one undo takes it away. */
  function placePrebuilt(prebuilt: Prebuilt, x: number, z: number) {
    const position = boundedPosition(x, z, world.environment, prebuilt.radius);
    const pieces = prebuiltObjects(
      prebuilt,
      position.x,
      position.z,
      placementRotation,
      world.environment,
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
  function switchLibrary(next: WorldLibrary): boolean {
    if (!saveLibrary(next)) {
      setSaved(false);
      setSaveError(
        "Your worlds could not be saved. Export a backup with Share before continuing.",
      );
      return false;
    }
    setLibrary(next);
    dispatch({ type: "open", world: activeWorld(next) });
    setIsShared(false);
    setSaved(true);
    setSaveError("");
    select(null);
    setTool({ type: "select" });
    setPreview(null);
    stroke.current = null;
    return true;
  }
  function createWorld(next: World): boolean {
    const current = updateLibrary(library, history.present);
    return switchLibrary(
      openLibraryWorld(current, { id: createObjectId(), world: next }),
    );
  }
  function startPreset(preset: Preset): boolean {
    const current = updateLibrary(library, history.present);
    return switchLibrary(
      openLibraryWorld(current, {
        id: createObjectId(),
        world: makePreset(preset),
        preview: true,
      }),
    );
  }
  function openWorld(id: string): boolean {
    if (id === library.activeId && !isShared) return true;
    const current = updateLibrary(library, history.present);
    return switchLibrary(
      openLibraryWorld(
        current,
        current.worlds.find((entry) => entry.id === id)!,
      ),
    );
  }
  function deleteWorld(id: string): boolean {
    const current = updateLibrary(library, history.present);
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
    if (id === current.activeId)
      dispatch({ type: "open", world: activeWorld(next) });
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
    library: updateLibrary(library, history.present),
    createWorld,
    startPreset,
    openWorld,
    deleteWorld,
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
    objects: keepStacked(objects, world.environment, environment),
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
