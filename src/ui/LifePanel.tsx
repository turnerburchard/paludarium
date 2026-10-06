import { plantCondition } from "../model/plants";
import type { World } from "../model/schema";
import type { EcosystemController } from "../simulation/useEcosystem";
import { frogsSupported } from "../simulation/engine";
import type { FoodPatch } from "../simulation/types";
import { AnimalStatus } from "./AnimalStatus";
export function LifePanel({
  world,
  ecosystem,
  selectedId,
  paused,
}: {
  world: World;
  ecosystem: EcosystemController;
  selectedId: string | null;
  paused: boolean;
}) {
  const { snapshot } = ecosystem;
  if (!snapshot.animals.length)
    return (
      <div className="life-panel">
        <p>Add a frog to start watching habitat life.</p>
      </div>
    );
  const animal = snapshot.animals.find((a) => a.id === selectedId);
  const hungry = snapshot.animals.filter((a) => a.needs.hunger > 0.65).length;
  const thirsty = snapshot.animals.filter(
    (a) => a.needs.hydration < 0.35,
  ).length;
  const frogs = snapshot.animals.length;
  const supported = Math.floor(frogsSupported(snapshot.food));
  const overcrowded = hungry > 0 && frogs > supported;
  const struggling = world.objects.filter(
    (o) => plantCondition(o, world.environment)?.thriving === false,
  ).length;
  return (
    <section className="life-panel" aria-label="Habitat life">
      <div className="life-heading">
        <span>
          {paused
            ? "Life paused"
            : snapshot.phase === "day"
              ? "Day in the habitat"
              : "Night in the habitat"}
        </span>
        <span>{plural(frogs, "frog")}</span>
      </div>
      {animal ? (
        <AnimalStatus animal={animal} />
      ) : (
        <p>
          {thirsty
            ? `${thirsty} ${thirsty === 1 ? "frog needs" : "frogs need"} moisture.`
            : hungry
              ? `${hungry} ${hungry === 1 ? "frog is" : "frogs are"} hungry.${
                  overcrowded
                    ? " There are more frogs than the insects here can feed. Add plants or moss so more insects can breed."
                    : ""
                }`
              : "Select a frog to see its activity and needs."}
        </p>
      )}
      {struggling > 0 && (
        <p>
          {plural(struggling, "plant")} {struggling === 1 ? "is" : "are"}{" "}
          struggling where {struggling === 1 ? "it's" : "they're"} planted.
          Select one to see why.
        </p>
      )}
      <div className="life-actions">
        <button onClick={ecosystem.feed}>Scatter insects</button>
        <button onClick={ecosystem.mist}>Mist habitat</button>
      </div>
      <small>{insectSummary(snapshot.food, supported)}</small>
    </section>
  );
}

function plural(n: number, noun: string, nouns = `${noun}s`) {
  return `${n} ${n === 1 ? noun : nouns}`;
}

function insectSummary(food: readonly FoodPatch[], supported: number) {
  const insects = plural(
    Math.ceil(food.reduce((sum, patch) => sum + patch.amount, 0)),
    "insect",
  );
  const colonies = food.filter((patch) => patch.capacity > 0).length;
  if (!colonies)
    return `${insects}. No colonies yet: plants and moss give insects cover to breed.`;
  return `${insects} in ${plural(colonies, "colony", "colonies")} · enough for about ${plural(supported, "frog")}`;
}
