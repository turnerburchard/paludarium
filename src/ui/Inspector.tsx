import { useEffect, useState } from "react";
import { Copy, Eye, Move, RotateCw, Skull, Trash2, X } from "lucide-react";
import { assets, isAnimal } from "../assets";
import type { Editor } from "../editor/useEditor";
import { plantCondition } from "../model/plants";
import type { HabitatObject } from "../model/schema";
import { IconButton } from "./IconButton";
import { MossPicker } from "./MossPicker";
import { RangeControl } from "./RangeControl";
import type { EcosystemController } from "../simulation/useEcosystem";
import { animalLife, MATURITY_AGE } from "../simulation/lifeCycle";
import { AnimalStatus } from "./AnimalStatus";

export function Inspector({
  editor,
  object,
  ecosystem,
  view,
  onWatch,
}: {
  editor: Editor;
  object: HabitatObject;
  ecosystem: EcosystemController;
  view: boolean;
  onWatch: () => void;
}) {
  const asset = assets[object.kind];
  const animal = isAnimal(object.kind);
  const life = animal ? animalLife(object) : null;
  const state = ecosystem.snapshot.animals.find((a) => a.id === object.id);
  const condition = plantCondition(object, editor.world.environment);
  const [aboutOpen, setAboutOpen] = useState(
    () => !matchMedia("(max-width: 760px)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(max-width: 760px)");
    const update = () => setAboutOpen(!media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <aside className="inspector" aria-label="Selected object">
      <div className="inspector-heading">
        <div>
          <h2>{asset.name}</h2>
        </div>
        <IconButton label="Deselect object" onClick={() => editor.select(null)}>
          <X size={17} />
        </IconButton>
      </div>
      <details
        className="more-options object-about"
        open={aboutOpen}
        onToggle={(event) => setAboutOpen(event.currentTarget.open)}
      >
        <summary>About this {animal ? "animal" : "object"}</summary>
        {asset.scientificName && (
          <p className="species-name">{asset.scientificName}</p>
        )}
        <p>{asset.description}</p>
      </details>
      {!view && condition && (
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
      {animal && (
        <button className="watch-button" onClick={onWatch}>
          <Eye size={17} />
          Watch up close
        </button>
      )}
      {!view && life && (
        <div className="animal-care">
          <p>
            {life.age < MATURITY_AGE
              ? "Juvenile · Growing"
              : life.age > life.lifespan * 0.8
                ? "Older adult"
                : "Adult"}
          </p>
          <label className="animal-condition">
            <span>Condition</span>
            <meter
              aria-label="Condition"
              min={0}
              max={1}
              low={0.4}
              high={0.7}
              optimum={1}
              value={life.condition}
            />
          </label>
          {!ecosystem.canLive(object.id) ? (
            <p>
              {asset.swims || asset.behavior?.water === "lives"
                ? "Stranded: it needs deeper water to live."
                : "Drowning: it needs dry land to live."}
            </p>
          ) : life.condition < 0.7 ? (
            <p>
              Condition is low. More planting or fewer animals gives the habitat
              time to recover.
            </p>
          ) : null}
          {state && <AnimalStatus animal={state} compact />}
        </div>
      )}
      {!view && (
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
          <button
            className={animal ? "kill-button" : undefined}
            onClick={editor.remove}
          >
            {animal ? <Skull size={18} /> : <Trash2 size={18} />}
            {animal ? "Kill" : "Remove"}
          </button>
        </div>
      )}
      {!view && asset.hardscape && (
        <MossPicker
          value={object.moss}
          onChange={(moss) => editor.patchObject(object.id, { moss })}
        />
      )}
      {!view && (object.kind === "rock" || object.kind === "wood") && (
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
