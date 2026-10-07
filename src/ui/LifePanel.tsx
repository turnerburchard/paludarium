import { Binoculars, Eye, Leaf, Moon } from "lucide-react";
import { assets } from "../assets";
import type { AssetKind, World } from "../model/schema";
import type { EcosystemController } from "../simulation/useEcosystem";
import { CreatureList } from "./CreatureList";

export function LifePanel({
  world,
  ecosystem,
  selectedId,
  paused,
  onWatch,
}: {
  world: World;
  ecosystem: EcosystemController;
  selectedId: string | null;
  paused: boolean;
  onWatch: (id: string) => void;
}) {
  const { snapshot } = ecosystem;
  const { habitat } = ecosystem;
  const animals = snapshot.animals;
  // Fish by species, each with the ids of the fish of that kind.
  const fish = new Map<AssetKind, string[]>();
  for (const object of world.objects)
    if (assets[object.kind].swims)
      fish.set(object.kind, [...(fish.get(object.kind) ?? []), object.id]);
  const fishIds = [...fish.values()].flat();
  const fishCount = fishIds.length;

  function surpriseMe() {
    // Busy land animals make the best viewing; fish are always on the move.
    const active = animals
      .filter(
        (animal) =>
          animal.moving ||
          animal.activity === "eating" ||
          animal.activity === "bathing",
      )
      .map((animal) => animal.id);
    const everyone = [...animals.map((animal) => animal.id), ...fishIds];
    const pool = [...active, ...fishIds].filter((id) => id !== selectedId);
    const candidates = pool.length
      ? pool
      : everyone.filter((id) => id !== selectedId);
    const id = candidates[Math.floor(Math.random() * candidates.length)];
    if (id) onWatch(id);
  }

  return (
    <section className="life-panel" aria-label="Habitat life">
      <div className="life-heading">
        <span>
          {paused || snapshot.phase !== "day" ? (
            <Moon size={15} />
          ) : (
            <Leaf size={15} />
          )}
          {paused ? "Paused" : snapshot.phase === "day" ? "Day" : "Night"}
        </span>
        <span>{animals.length + fishCount} inhabitants</span>
      </div>
      {habitat.population > 0 && (
        <p>
          {habitat.food < 1
            ? "More planting would support this population."
            : "Enough planting for this population."}
          {habitat.space < 1 &&
            " The tank is crowded. A larger habitat would help."}{" "}
          Breeding needs spare food and space.
        </p>
      )}
      {animals.length + fishCount === 0 && (
        <p>Nothing lives here yet. Add an animal or some fish.</p>
      )}
      {animals.length + fishCount > 0 && (
        <button className="life-follow" onClick={surpriseMe}>
          <Binoculars size={19} />
          Follow someone
        </button>
      )}
      {animals.length > 0 && (
        <>
          <h3 className="life-group">Animals</h3>
          <CreatureList
            world={world}
            animals={animals}
            selectedId={selectedId}
            onWatch={onWatch}
          />
        </>
      )}
      {fishCount > 0 && (
        <>
          <h3 className="life-group">Fish</h3>
          <ul className="frog-list fish-list">
            {[...fish].map(([kind, ids]) => (
              <li key={kind}>
                {/* Following a species picks one of its fish. */}
                <button
                  onClick={() =>
                    onWatch(ids[Math.floor(Math.random() * ids.length)])
                  }
                  aria-pressed={ids.includes(selectedId ?? "")}
                >
                  <span>{assets[kind].name}</span>
                  <small>×{ids.length}</small>
                  <Eye size={15} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
