import { Check, Copy, Droplets, Move, Paintbrush, Plus, X } from "lucide-react";
import { assets } from "../assets";
import type { Editor } from "../editor/useEditor";
import { PlacementRotation } from "./PlacementRotation";
import { SpringSettings } from "./SpringControls";
import { BrushSettings } from "./TerrainControls";
import { terrainTools } from "./terrainTools";

/** Controls for the active editing tool. */
export function BottomHud({ editor }: { editor: Editor }) {
  const { tool, world } = editor;
  if (tool.type === "select") return null;
  const kind =
    tool.type === "place"
      ? tool.kind
      : tool.type === "move" || tool.type === "copy"
        ? world.objects.find((o) => o.id === tool.id)?.kind
        : undefined;
  const name =
    tool.type === "prebuilt"
      ? tool.prebuilt.name
      : kind
        ? assets[kind].name
        : "";
  const adding = tool.type === "place" || tool.type === "prebuilt";
  const verb =
    tool.type === "move"
      ? "Moving"
      : tool.type === "copy"
        ? "Copying"
        : "Placing";
  const touch = matchMedia("(pointer: coarse)").matches;
  const tap = touch ? "Tap" : "Click";
  // Phones have no Escape key; they finish with the Done button.
  const escape = touch ? "" : " · Escape to finish";
  let title = `${verb} ${name.toLowerCase()}`,
    hint = `${tap} to place · Drag to spin`;
  if (tool.type === "terrain") {
    title = terrainTools.find((brush) => brush.mode === tool.mode)?.label ?? "";
    hint = `Drag to brush${escape}`;
  } else if (tool.type === "spring") {
    title =
      tool.index === null ? "Adding a spring" : `Spring ${tool.index + 1}`;
    hint =
      tool.index === null
        ? `${tap} the ground where water should well up`
        : `${tap} the ground to move it${escape}`;
  }
  const turns = tool.type !== "terrain" && tool.type !== "spring";
  const done = adding || !turns;
  const spring = tool.type === "spring" ? tool.index : null;
  return (
    <div className="bottom-hud placing">
      <div
        className={
          tool.type === "terrain" || spring !== null
            ? "placement-bar with-settings"
            : "placement-bar"
        }
      >
        <span className="placement-icon">
          {tool.type === "terrain" ? (
            <Paintbrush size={20} />
          ) : tool.type === "spring" ? (
            <Droplets size={20} />
          ) : tool.type === "move" ? (
            <Move size={20} />
          ) : tool.type === "copy" ? (
            <Copy size={20} />
          ) : (
            <Plus size={20} />
          )}
        </span>
        <div className="placement-text">
          <strong>{title}</strong>
          <span role="status" aria-live="polite">
            {editor.placementError || hint}
          </span>
        </div>
        {turns && <PlacementRotation editor={editor} />}
        <button className="finish-button" onClick={editor.finish}>
          {done ? <Check size={16} /> : <X size={16} />}
          {done ? "Done" : "Cancel"}
        </button>
        {tool.type === "terrain" && (
          <BrushSettings editor={editor} brush={tool} />
        )}
        {spring !== null && <SpringSettings editor={editor} index={spring} />}
      </div>
    </div>
  );
}
