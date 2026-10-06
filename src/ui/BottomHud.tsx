import { Check, MousePointer2, Plus, RotateCw, X } from "lucide-react";
import { assets } from "../assets";
import type { Editor } from "../editor/useEditor";
import { IconButton } from "./IconButton";

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
    <div className="bottom-hud">
      {tool.type !== "select" ? (
        <div className="placement-bar">
          <span className="placement-icon">
            <Plus size={20} />
          </span>
          <div>
            <strong>
              {tool.type === "terrain"
                ? "Shaping your landscape"
                : `${verb} ${kind ? assets[kind].name.toLowerCase() : ""}`}
            </strong>
            <span>
              {tool.type === "terrain"
                ? "Drag to brush · Escape to finish"
                : "Tap a spot in the tank · drag to orbit"}
            </span>
          </div>
          {tool.type !== "terrain" && (
            <IconButton
              label="Rotate placement (R)"
              onClick={() => editor.rotate()}
            >
              <RotateCw size={18} />
            </IconButton>
          )}
          <button className="finish-button" onClick={editor.finish}>
            {tool.type === "place" || tool.type === "terrain" ? <Check size={16} /> : <X size={16} />}
            {tool.type === "place" || tool.type === "terrain" ? "Done" : "Cancel"}
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
