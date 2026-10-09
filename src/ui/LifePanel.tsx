import { useState } from "react";
import { Binoculars, Eye, Leaf, Moon, ScrollText } from "lucide-react";
import { assets } from "../assets";
import type { AssetKind, LogEntry, World } from "../model/schema";
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
  // Fish are listed by species instead.
  const animals = snapshot.animals.filter(
    (animal) => animal.surface !== "water",
  );
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
          Follow a creature
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

function describe({ event, kind, cause }: LogEntry) {
  const name = assets[kind].name;
  if (event === "born") return `${name} born.`;
  if (cause === "age") return `${name} died of old age.`;
  if (cause === "starved") return `${name} died of starvation.`;
  if (cause === "crowded") return `${name} died of overcrowding.`;
  if (cause === "drowned") return `${name} drowned.`;
  if (cause === "stranded") return `${name} died out of water.`;
  if (cause === "killed") return `${name} was killed.`;
  return `${name} died.`;
}

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
