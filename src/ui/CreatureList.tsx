import { Eye } from "lucide-react";
import { assets } from "../assets";
import type { World } from "../model/schema";
import type { AnimalState } from "../simulation/types";
import { activityLabels } from "./AnimalStatus";
import { animalLife, MATURITY_AGE } from "../simulation/lifeCycle";

export function CreatureList({
  world,
  animals,
  selectedId,
  onWatch,
}: {
  world: World;
  animals: readonly AnimalState[];
  selectedId?: string | null;
  onWatch: (id: string) => void;
}) {
  return (
    <ul className="frog-list">
      {animals.map((animal) => {
        const object = world.objects.find((object) => object.id === animal.id);
        if (!object) return null;
        return (
          <li key={animal.id}>
            <button
              onClick={() => onWatch(animal.id)}
              aria-pressed={animal.id === selectedId}
            >
              <span>
                {assets[object.kind].name}
                {animalLife(object).age < MATURITY_AGE && " · Juvenile"}
              </span>
              <small>{activityLabels[animal.activity]}</small>
              <Eye size={15} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
