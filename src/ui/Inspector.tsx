import { Copy, Eye, Move, RotateCw, Trash2, X } from "lucide-react";
import { assets, isLandAnimal } from "../assets";
import type { Editor } from "../editor/useEditor";
import { MOSS_COLORS } from "../assets/landscape/mosses";
import { mossSpecies, type MossSpecies } from "../model/moss";
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
      <details className="more-options object-about">
        <summary>
          About this {asset.category === "Animals" ? "animal" : "object"}
        </summary>
        {asset.scientificName && (
          <p className="species-name">{asset.scientificName}</p>
        )}
        <p>{asset.description}</p>
      </details>
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
      {isLandAnimal(object.kind) && (
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
      {asset.mossGrows && (
        <div className="moss-options" role="group" aria-label="Moss">
          <span className="section-label">MOSS</span>
          <div>
            {[undefined, ...mossSpecies].map((species) => (
              <button
                key={species ?? "none"}
                aria-pressed={object.moss === species}
                onClick={() => editor.patchObject(object.id, { moss: species })}
              >
                <span
                  className={species ? "moss-swatch" : "moss-swatch bare"}
                  style={{
                    background: species ? MOSS_COLORS[species][0] : undefined,
                  }}
                />
                {species ? mossNames[species] : "Bare"}
              </button>
            ))}
          </div>
        </div>
      )}
      {(object.kind === "rock" || object.kind === "wood") && (
        <details className="more-options">
          <summary>Adjust size</summary>
          <RangeControl
            label="Size"
            value={object.scale}
            min={0.4}
            max={2}
            step={0.05}
            format={(n) => `${Math.round(n * 100)}%`}
            onPreview={(scale) => editor.previewObject(object.id, { scale })}
            onCommit={(scale) => editor.patchObject(object.id, { scale })}
          />
        </details>
      )}
    </aside>
  );
}

const mossNames: Record<MossSpecies, string> = {
  sheet: "Sheet",
  cushion: "Cushion",
  fern: "Fern",
  java: "Java",
};
