import { useState } from "react";
import { Eye, X } from "lucide-react";
import { assets, isLandAnimal } from "../assets";
import type { World } from "../model/schema";
import type { EcosystemController } from "../simulation/useEcosystem";
import { activityLabels } from "./AnimalStatus";

export function ViewControls({
  world,
  ecosystem,
  onWatch,
}: {
  world: World;
  ecosystem: EcosystemController;
  onWatch: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const frogs = world.objects.filter((object) => isLandAnimal(object.kind));
  return (
    <div className="view-controls">
      {open && (
        <section className="watch-picker" aria-label="Choose a frog">
          <p>Pick a frog to follow</p>
          <ul className="frog-list">
            {frogs.map((object) => {
              const animal = ecosystem.snapshot.animals.find(
                (animal) => animal.id === object.id,
              );
              return (
                <li key={object.id}>
                  <button onClick={() => onWatch(object.id)}>
                    <span>{assets[object.kind].name}</span>
                    {animal && <small>{activityLabels[animal.activity]}</small>}
                    <Eye size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {frogs.length > 0 ? (
        <button
          className="watch-world-button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={17} /> : <Eye size={17} />}
          {open ? "Close frog list" : "Watch a frog"}
        </button>
      ) : (
        <p className="view-hint">Switch to Build to create your habitat.</p>
      )}
    </div>
  );
}
