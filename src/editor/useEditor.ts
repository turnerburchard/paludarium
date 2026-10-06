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
import { loadWorld, saveWorld } from "./persistence";
export type Tool =
  | { type: "select" }
  | { type: "place"; kind: AssetKind }
  | { type: "move"; id: string }
  | { type: "copy"; id: string };
export function useEditor() {
  const [initial] = useState(loadWorld);
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initial.world,
    future: [],
  });
  const world = history.present;
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
      setSaved(saveWorld(world));
      setSaving(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [world]);
  const patchObject = useCallback(
    (id: string, patch: Partial<HabitatObject>) => {
      const current = worldRef.current;
      commit({
        ...current,
        objects: current.objects.map((o) =>
          o.id === id ? fitObject({ ...o, ...patch }, current.environment) : o,
        ),
      });
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
      if (
        (e.target as HTMLElement)?.closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (e.key === "Escape") {
        setTool({ type: "select" });
        select(null);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      } else if (e.key.toLowerCase() === "r")
        rotate(e.shiftKey ? -Math.PI / 6 : Math.PI / 6);
      else if (e.code === "Space") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [remove, rotate]);
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
    const environment = { ...world.environment, ...patch };
    commit({
      ...world,
      environment,
      objects: world.objects.map((o) => fitObject(o, environment)),
    });
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
    notify("Choose a new spot. Escape to cancel.");
  }
  function duplicate() {
    if (!selected || world.objects.length >= MAX_OBJECTS) return;
    setPlacementRotation(selected.rotation);
    setTool({ type: "copy", id: selected.id });
    notify("Choose a spot for the copy. Escape to cancel.");
  }
  return {
    world,
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
    placeAt,
    changeEnvironment,
    patchObject,
    remove,
    rotate,
    duplicate,
    move,
    replaceWorld,
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    canUndo: !!history.past.length,
    canRedo: !!history.future.length,
  };
}
export type Editor = ReturnType<typeof useEditor>;
