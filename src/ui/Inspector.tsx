import { Copy, Eye, Move, RotateCw, Trash2, X } from "lucide-react";
import { assets, isFrog } from "../assets";
import type { Editor } from "../editor/useEditor";
import { plantCondition } from "../model/plants";
import type { HabitatObject } from "../model/schema";
import { IconButton } from "./IconButton";
import { RangeControl } from "./RangeControl";

export function Inspector({
  editor,
  object,
  onWatch,
}: {
  editor: Editor;
  object: HabitatObject;
  onWatch: () => void;
}) {
  const asset = assets[object.kind];
  const condition = plantCondition(object, editor.world.environment);
  return (
    <aside className="inspector" aria-label="Selected object">
      <div className="inspector-heading">
        <div>
          <span className="eyebrow">IN YOUR WORLD</span>
          <h2>{asset.name}</h2>
        </div>
        <IconButton label="Deselect object" onClick={() => editor.select(null)}>
          <X size={17} />
        </IconButton>
      </div>
      {asset.scientificName && (
        <p className="species-name">{asset.scientificName}</p>
      )}
      <p>{asset.description}</p>
      {condition && (
        <p
          className={
            condition.thriving
              ? "plant-condition"
              : "plant-condition struggling"
          }
        >
          {condition.note}
        </p>
      )}
      {isFrog(object.kind) && (
        <button className="watch-button" onClick={onWatch}>
          <Eye size={17} />
          Watch up close
        </button>
      )}
      <div className="object-actions">
        <button onClick={editor.move}>
          <Move size={18} />
          Move
        </button>
        <button onClick={() => editor.rotate()}>
          <RotateCw size={18} />
          Turn
        </button>
        <button onClick={editor.duplicate}>
          <Copy size={18} />
          Copy
        </button>
        <button onClick={editor.remove}>
          <Trash2 size={18} />
          Remove
        </button>
      </div>
      <RangeControl
        label="Size"
        value={object.scale}
        min={0.4}
        max={2}
        step={0.05}
        format={(n) => `${Math.round(n * 100)}%`}
        onCommit={(scale) => editor.patchObject(object.id, { scale })}
      />
    </aside>
  );
}
