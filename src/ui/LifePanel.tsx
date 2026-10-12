import { useState } from "react";
import { Binoculars, Leaf, Moon, ScrollText } from "lucide-react";
import { assets, isAnimal } from "../assets";
import type { LogEntry, World } from "../model/schema";
import {
  useEcosystemSnapshot,
  type EcosystemController,
} from "../simulation/useEcosystem";
import { CreatureList } from "./CreatureList";
import { describe } from "./lifeEvents";

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
  const snapshot = useEcosystemSnapshot(ecosystem);
  const { habitat } = ecosystem;
  const animals = world.objects.filter((o) => isAnimal(o.kind));
  const land = animals.filter((o) => !assets[o.kind].swims);
  const fish = animals.filter((o) => assets[o.kind].swims);

  function surpriseMe() {
    // Busy land animals make the best viewing; fish are always on the move.
    const active = snapshot.animals
      .filter(
        (animal) =>
          animal.surface !== "water" &&
          (animal.moving ||
            animal.activity === "eating" ||
            animal.activity === "bathing"),
      )
      .map((animal) => animal.id);
    const fishIds = fish.map((o) => o.id);
    const pool = [...active, ...fishIds].filter((id) => id !== selectedId);
    const candidates = pool.length
      ? pool
      : animals.map((o) => o.id).filter((id) => id !== selectedId);
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
        <span>
          {animals.length} {animals.length === 1 ? "inhabitant" : "inhabitants"}
        </span>
      </div>
      {habitat.population > 0 && (
        <p>
          {habitat.food < 1
            ? habitat.land.food < 1 && habitat.aquatic.food < 1
              ? "More land and aquatic planting would support this population."
              : habitat.aquatic.food < 1
                ? "More aquatic planting would support this population."
                : "More land planting would support this population."
            : "Enough planting for this population."}
          {habitat.space < 1 &&
            " The tank is crowded. A larger habitat would help."}{" "}
          Breeding needs spare food and space.
        </p>
      )}
      {animals.length === 0 && (
        <p>Nothing lives here yet. Add an animal or some fish.</p>
      )}
      {animals.length > 0 && (
        <button className="life-follow" onClick={surpriseMe}>
          <Binoculars size={19} />
          Follow a creature
        </button>
      )}
      {land.length > 0 && (
        <>
          <h3 className="life-group">Animals</h3>
          <CreatureList
            objects={land}
            animals={snapshot.animals}
            selectedId={selectedId}
            onWatch={onWatch}
          />
        </>
      )}
      {fish.length > 0 && (
        <>
          <h3 className="life-group">Fish</h3>
          <CreatureList
            objects={fish}
            animals={snapshot.animals}
            selectedId={selectedId}
            onWatch={onWatch}
            fish
          />
        </>
      )}
      <LifeLog log={world.log ?? []} />
    </section>
  );
}

const logTime = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Births and deaths, newest first, kept out of the way until asked for. */
function LifeLog({ log }: { log: LogEntry[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="life-log-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <ScrollText size={14} />
        Life log
      </button>
      {open &&
        (log.length ? (
          <ol className="life-log" aria-label="Life log">
            {log
              .map((entry, i) => (
                <li key={i}>
                  <time dateTime={new Date(entry.at).toISOString()}>
                    {logTime.format(entry.at)}
                  </time>
                  {describe(entry)}
                </li>
              ))
              .reverse()}
          </ol>
        ) : (
          <p>No births or deaths recorded.</p>
        ))}
    </>
  );
}
