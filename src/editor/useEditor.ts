import { createObjectId } from "../model/objectId";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { assets } from "../assets";
import {
  MAX_OBJECTS,
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
import { boundedPosition, fitObject, placementProblem } from "../model/terrain";
import { historyReducer } from "./history";
import { TerrainStroke } from "./terrainStroke";
import type { TerrainBrush } from "../model/terrainBrush";
import { loadWorld, saveWorld } from "./persistence";
export type Tool =
  | { type: "select" }
  | { type: "place"; kind: AssetKind }
  | { type: "move"; id: string }
  | { type: "copy"; id: string }
  | ({ type: "terrain" } & TerrainBrush);
export function useEditor(readOnly = false, sharedWorld?: World) {
  const [initial] = useState(loadWorld);
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initial.world,
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
  const [message, notify] = useState(initial.warning ?? "");
  const [saved, setSaved] = useState(true);
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
    if (isShared || (initial.warning && history.present === initial.world))
      return;
    setSaving(true);
    const timer = setTimeout(() => {
      setSaved(saveWorld(history.present));
      setSaving(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [history.present, isShared, initial]);
  useEffect(() => {
    stroke.current = null;
    setPreview(null);
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
    // Moving or copying an object that undo may take away ends here.
    setTool((tool) =>
      tool.type === "move" || tool.type === "copy" ? { type: "select" } : tool,
    );
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
    notify("Landscape updated. Undo reverses the whole stroke.");
  }
  const patchObject = useCallback(
    (id: string, patch: Partial<HabitatObject>) => {
      commit(withObjectPatch(worldRef.current, id, patch));
    },
    [commit],
  );
  const remove = useCallback(() => {
    if (!selectedId) return;
    commit({
      ...worldRef.current,
      objects: replaceObject(
        worldRef.current.objects,
        worldRef.current.environment,
        selectedId,
      ),
    });
    select(null);
    setTool({ type: "select" });
    notify("Removed. Undo will bring it back.");
  }, [commit, selectedId]);
  const rotate = useCallback(
    (amount = Math.PI / 6) => {
      if (tool.type === "terrain") return;
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
  /** Leaves placing or moving and clears its leftover message. */
  function finish() {
    cancelTerrainStroke();
    setTool({ type: "select" });
    notify("");
  }
  function choose(kind: AssetKind) {
    setTool({ type: "place", kind });
    select(null);
    setPlacementRotation(0);
    notify("");
  }
  /** Places the tool's object at a spot on the ground, or on top of a stone
   * or wood piece when `surface` names one and the height of the spot. */
  function placeAt(x: number, z: number, surface?: Surface) {
    const moving =
      tool.type === "move" || tool.type === "copy"
        ? world.objects.find((o) => o.id === tool.id)
        : null;
    const kind = tool.type === "place" ? tool.kind : moving?.kind;
    if (!kind) return;
    const position = boundedPosition(
      x,
      z,
      world.environment,
      assets[kind].radius * (moving?.scale ?? 1),
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
      notify("It can't rest on something that's sitting on it.");
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
      notify(problem);
      return;
    }
    if (moving && tool.type === "move") {
      patchObject(moving.id, {
        ...position,
        ...resting,
        rotation: placementRotation,
      });
      setTool({ type: "select" });
      notify("Just right.");
      return;
    }
    if (world.objects.length >= MAX_OBJECTS) {
      notify("This world is full. Remove an object to make room.");
      return;
    }
    const object: HabitatObject = {
      id: createObjectId(),
      kind,
      ...position,
      ...(resting.support && resting),
      rotation: placementRotation,
      scale: moving?.scale ?? 1,
      seed: moving?.seed ?? Math.floor(Math.random() * 2147483647),
      ...(moving?.moss && { moss: moving.moss }),
    };
    commit({ ...world, objects: [...world.objects, object] });
    if (tool.type === "copy") {
      select(object.id);
      setTool({ type: "select" });
    }
    notify(`${assets[kind].name} added. Place another, or finish.`);
  }
  function changeEnvironment(patch: Partial<Environment>) {
    commit(withEnvironment(world, patch));
  }
  function rename(name: string) {
    if (name !== world.name) commit({ ...world, name });
  }
  function replaceWorld(next: World) {
    commit(next);
    select(null);
    setTool({ type: "select" });
  }
  function move() {
    if (!selected) return;
    setPlacementRotation(selected.rotation);
    setTool({ type: "move", id: selected.id });
    notify("");
  }
  function duplicate() {
    if (!selected || world.objects.length >= MAX_OBJECTS) return;
    setPlacementRotation(selected.rotation);
    setTool({ type: "copy", id: selected.id });
    notify("");
  }
  return {
    world: shown,
    firstVisit: initial.firstVisit,
    isShared,
    updateLife,
    adoptSharedWorld: () => {
      if (!isShared || !shared) return false;
      const saved = saveWorld(shared);
      commit(shared);
      setIsShared(false);
      setSaved(saved);
      return saved;
    },
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
    message,
    notify,
    saved,
    saving,
    paused,
    setPaused,
    placementRotation,
    choose,
    finish,
    placeAt,
    changeEnvironment,
    patchObject,
    remove,
    rotate,
    duplicate,
    move,
    replaceWorld,
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
