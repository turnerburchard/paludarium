import { Binoculars, Leaf, Moon } from "lucide-react";
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
  const animals = snapshot.animals;
  const fish = new Map<AssetKind, number>();
  for (const object of world.objects)
    if (assets[object.kind].swims)
      fish.set(object.kind, (fish.get(object.kind) ?? 0) + 1);
  const fishCount = [...fish.values()].reduce((sum, n) => sum + n, 0);

  function surpriseMe() {
    const others = animals.filter((animal) => animal.id !== selectedId);
    const active = others.filter(
      (animal) =>
        animal.moving ||
        animal.activity === "eating" ||
        animal.activity === "bathing",
    );
    const candidates = active.length
      ? active
      : others.length
        ? others
        : animals;
    const animal = candidates[Math.floor(Math.random() * candidates.length)];
    if (animal) onWatch(animal.id);
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
      {animals.length + fishCount === 0 && (
        <p>Nothing lives here yet. Add an animal or some fish.</p>
      )}
      {animals.length > 0 && (
        <>
          <button className="life-follow" onClick={surpriseMe}>
            <Binoculars size={19} />
            Follow someone
          </button>
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
          <ul className="fish-list">
            {[...fish].map(([kind, count]) => (
              <li key={kind}>
                <span>{assets[kind].name}</span>
                <small>×{count}</small>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
