import { Eye } from "lucide-react";
import { assets } from "../assets";
import { animalLife, lifeStage } from "../model/life";
import type { HabitatObject } from "../model/schema";
import type { AnimalState } from "../simulation/types";
import { activityLabels, stageLabels } from "./AnimalStatus";

/** Animals to watch, each with how old it is and what it is doing. */
export function CreatureList({
  objects,
  animals,
  selectedId,
  onWatch,
  fish = false,
}: {
  objects: readonly HabitatObject[];
  animals: readonly AnimalState[];
  selectedId?: string | null;
  onWatch: (id: string) => void;
  fish?: boolean;
}) {
  return (
    <ul className={fish ? "frog-list fish-list" : "frog-list"}>
      {objects.map((object) => {
        const life = animalLife(object);
        const animal = animals.find((animal) => animal.id === object.id);
        return (
          <li key={object.id}>
            <button
              onClick={() => onWatch(object.id)}
              aria-pressed={object.id === selectedId}
            >
              <span>
                {object.name ?? assets[object.kind].name}{" "}
                <small>
                  {stageLabels[lifeStage(life)]} · {formatAge(life.age)}
                </small>
              </span>
              <small>{animal && activityLabels[animal.activity]}</small>
              <Eye size={15} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Age in active minutes, and hours once past the first. */
function formatAge(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
