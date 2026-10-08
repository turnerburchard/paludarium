import { X } from "lucide-react";
import { assets } from "../assets";
import type { HabitatObject } from "../model/schema";
import type { EcosystemController } from "../simulation/useEcosystem";
import { activityLabels } from "./AnimalStatus";
import { IconButton } from "./IconButton";

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
  return (
    <aside className="inspector watch-card" aria-label="Watching">
      <div className="inspector-heading">
        <div>
          <h2>{asset.name}</h2>
        </div>
        <IconButton label="Stop watching" onClick={onStop}>
          <X size={17} />
        </IconButton>
      </div>
      {animal ? (
        <p>{activityLabels[animal.activity]}</p>
      ) : asset.swims ? (
        <p>Swimming</p>
      ) : null}
    </aside>
  );
}
