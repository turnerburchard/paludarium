import {
  Check,
  Copy,
  MousePointer2,
  Move,
  Paintbrush,
  Plus,
  X,
} from "lucide-react";
import { assets } from "../assets";
import type { Editor } from "../editor/useEditor";
import { PlacementRotation } from "./PlacementRotation";
import { terrainTools } from "./terrainTools";

/** Placement controls while placing or moving, navigation hints otherwise. */
export function BottomHud({ editor }: { editor: Editor }) {
  const { tool, world } = editor;
  const kind =
    tool.type === "place"
      ? tool.kind
      : tool.type === "move" || tool.type === "copy"
        ? world.objects.find((o) => o.id === tool.id)?.kind
        : undefined;
  const verb =
    tool.type === "move"
      ? "Moving"
      : tool.type === "copy"
        ? "Copying"
        : "Placing";
  return (
    <div
      className={tool.type === "select" ? "bottom-hud" : "bottom-hud placing"}
    >
      {tool.type !== "select" ? (
        <div className="placement-bar">
          <span className="placement-icon">
            {tool.type === "terrain" ? (
              <Paintbrush size={20} />
            ) : tool.type === "move" ? (
              <Move size={20} />
            ) : tool.type === "copy" ? (
              <Copy size={20} />
            ) : (
              <Plus size={20} />
            )}
          </span>
          <div>
            <strong>
              {tool.type === "terrain"
                ? terrainTools.find((brush) => brush.mode === tool.mode)?.label
                : `${verb} ${kind ? assets[kind].name.toLowerCase() : ""}`}
            </strong>
            <span>
              {tool.type === "terrain"
                ? "Drag to brush · Escape to finish"
                : "Tap to place · Two-finger drag to pan"}
            </span>
          </div>
          {tool.type !== "terrain" && <PlacementRotation editor={editor} />}
          <button className="finish-button" onClick={editor.finish}>
            {tool.type === "place" || tool.type === "terrain" ? (
              <Check size={16} />
            ) : (
              <X size={16} />
            )}
            {tool.type === "place" || tool.type === "terrain"
              ? "Done"
              : "Cancel"}
          </button>
        </div>
      ) : (
        <div className="navigation-hint">
          <MousePointer2 size={14} />
          <span>WASD to move</span>
          <i />
          <span>Drag to orbit</span>
          <i />
          <span>Scroll / pinch to zoom</span>
          <i />
          <span>Click to select</span>
        </div>
      )}
      <div className="status-message" role="status" aria-live="polite">
        {editor.message}
      </div>
    </div>
  );
}
