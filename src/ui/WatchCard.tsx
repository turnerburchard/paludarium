import { X } from "lucide-react";
import { assets } from "../assets";
import type { HabitatObject } from "../model/schema";
import type { EcosystemController } from "../simulation/useEcosystem";
import { AnimalStatus } from "./AnimalStatus";
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
      {animal ? (
        <AnimalStatus animal={animal} compact />
      ) : (
        <p>This frog can't reach any ground right now.</p>
      )}
    </aside>
  );
}
