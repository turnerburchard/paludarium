import { X } from "lucide-react";
import { assets } from "../assets";
import type { HabitatObject } from "../model/schema";
import type { EcosystemController } from "../simulation/useEcosystem";
import { AnimalStatus } from "./AnimalStatus";
import { IconButton } from "./IconButton";
import { animalLife, MATURITY_AGE } from "../simulation/lifeCycle";

/** Shown instead of the inspector while the camera follows an animal. */
export function WatchCard({
  object,
  ecosystem,
  onStop,
}: {
  object: HabitatObject;
  ecosystem: EcosystemController;
  onStop: () => void;
}) {
  const asset = assets[object.kind];
  const animal = ecosystem.snapshot.animals.find((a) => a.id === object.id);
  const aquatic = asset.swims || asset.behavior?.water === "lives";
  const life = animalLife(object);
  let lifeStage = "Adult";
  if (life.age < MATURITY_AGE) lifeStage = "Juvenile · Growing";
  else if (life.age > life.lifespan * 0.8) lifeStage = "Older adult";
  return (
    <aside className="inspector" aria-label="Watching">
      <div className="inspector-heading">
        <div>
          <span className="eyebrow">WATCHING</span>
          <h2>{asset.name}</h2>
        </div>
        <IconButton label="Stop watching" onClick={onStop}>
          <X size={17} />
        </IconButton>
      </div>
      <p>{lifeStage}</p>
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
          {aquatic
            ? "Stranded: it needs deeper water to live."
            : "Drowning: it needs dry land to live."}
        </p>
      ) : (
        life.condition < 0.7 && (
          <p>
            Condition is low. More planting or fewer animals gives the habitat
            time to recover.
          </p>
        )
      )}
      {animal ? (
        <AnimalStatus animal={animal} compact />
      ) : (
        asset.swims && <p>{asset.description}</p>
      )}
    </aside>
  );
}
