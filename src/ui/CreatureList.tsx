import { Eye } from "lucide-react";
import { assets } from "../assets";
import type { World } from "../model/schema";
import type { AnimalState } from "../simulation/types";
import { activityLabels, stageLabels } from "./AnimalStatus";
import { animalLife, lifeStage } from "../model/life";

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
        const stage = lifeStage(animalLife(object));
        return (
          <li key={animal.id}>
            <button
              onClick={() => onWatch(animal.id)}
              aria-pressed={animal.id === selectedId}
            >
              <span>
                {object.name ?? assets[object.kind].name}
                {stage !== "adult" && ` · ${stageLabels[stage]}`}
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
