import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { assets } from "../assets";
import {
  MAX_OBJECTS,
  type AssetKind,
  type HabitatObject,
  type World,
  type Environment,
} from "../model/schema";
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
export function useEditor() {
  const [initial] = useState(loadWorld);
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initial.world,
    future: [],
  });
  const world = history.present;
  // A gesture previews only its original world; committing retires it.
  const [preview, setPreview] = useState<{ base: World; world: World } | null>(null);
  const shown = preview?.base === world ? preview.world : world;
  const stroke = useRef<TerrainStroke | null>(null);
  const [tool, setTool] = useState<Tool>({ type: "select" });
  const [selectedId, select] = useState<string | null>(null);
  const [message, notify] = useState(initial.warning ?? "");
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [placementRotation, setPlacementRotation] = useState(0);
  const worldRef = useRef(world);
  worldRef.current = world;
  const selected = world.objects.find((o) => o.id === selectedId) ?? null;
  const commit = useCallback(
    (next: World) => dispatch({ type: "commit", world: next }),
    [],
  );
  useEffect(() => {
    setSaving(true);
    const timer = setTimeout(() => {
      setSaved(saveWorld(history.present));
      setSaving(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [history.present]);
  useEffect(() => {
    stroke.current = null;
    setPreview(null);
  }, [tool]);
  function cancelTerrainStroke() {
    stroke.current = null;
    setPreview(null);
  }
  function beginTerrainStroke(x: number, z: number) {
    if (tool.type !== "terrain") return;
    stroke.current = new TerrainStroke(history.present, tool);
    setPreview({ base: stroke.current.original, world: stroke.current.dab(x, z) });
  }
  function continueTerrainStroke(x: number, z: number) {
    if (stroke.current) setPreview({ base: stroke.current.original, world: stroke.current.dab(x, z) });
  }
  function endTerrainStroke() {
    const current = stroke.current;
    if (!current) return;
    stroke.current = null;
    setPreview(null);
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
      objects: worldRef.current.objects.filter((o) => o.id !== selectedId),
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
      if (target?.closest("input,textarea,select,[contenteditable=true]"))
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        cancelTerrainStroke();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
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
      // Space on a focused button presses it; elsewhere it pauses life.
      else if (e.code === "Space" && !target?.closest("button,a")) {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [remove, rotate]);
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
  function placeAt(x: number, z: number) {
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
    const problem = placementProblem(
      kind,
      position.x,
      position.z,
      world.environment,
    );
    if (problem) {
      notify(problem);
      return;
    }
    if (moving && tool.type === "move") {
      patchObject(moving.id, { ...position, rotation: placementRotation });
      setTool({ type: "select" });
      notify("Just right.");
      return;
    }
    if (world.objects.length >= MAX_OBJECTS) {
      notify("This world is full. Remove an object to make room.");
      return;
    }
    const object: HabitatObject = {
      id: crypto.randomUUID(),
      kind,
      ...position,
      rotation: placementRotation,
      scale: moving?.scale ?? 1,
      seed: moving?.seed ?? Math.floor(Math.random() * 2147483647),
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
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    canUndo: !!history.past.length,
    canRedo: !!history.future.length,
  };
}
export type Editor = ReturnType<typeof useEditor>;

function withEnvironment(world: World, patch: Partial<Environment>): World {
  const environment = { ...world.environment, ...patch };
  return {
    ...world,
    environment,
    objects: world.objects.map((o) => fitObject(o, environment)),
  };
}

function withObjectPatch(
  world: World,
  id: string,
  patch: Partial<HabitatObject>,
): World {
  return {
    ...world,
    objects: world.objects.map((o) =>
      o.id === id ? fitObject({ ...o, ...patch }, world.environment) : o,
    ),
  };
}
