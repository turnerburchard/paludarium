import { Binoculars, Eye, Leaf, Moon, Waves } from "lucide-react";
import { assets } from "../assets";
import { plantCondition } from "../model/plants";
import type { World } from "../model/schema";
import type { DiscoveryKind } from "../simulation/discoveries";
import type { EcosystemController } from "../simulation/useEcosystem";
import { insectEatersSupported } from "../simulation/engine";
import { CreatureList } from "./CreatureList";

const fieldNotes: Record<DiscoveryKind, { title: string; text: string }> = {
  hunt: {
    title: "A tiny hunter",
    text: "Found insects and stopped for a meal.",
  },
  leaf: {
    title: "A leaf with a view",
    text: "Settled on a leaf perch above the forest floor.",
  },
  glass: {
    title: "Gravity is optional",
    text: "Climbed the glass to explore another surface.",
  },
  shelter: { title: "A place to hide", text: "Tucked into a sheltered den." },
  soak: {
    title: "Down by the water",
    text: "Found a damp shoreline for a soak.",
  },
  sleep: {
    title: "Taking it slow",
    text: "Settled in for a sleep during the quiet part of the day.",
  },
};

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
  const fishCount = world.objects.filter(
    (object) => assets[object.kind].swims,
  ).length;
  const fishOnly = fishCount > 0 && animals.length === 0;
  const eaters = animals.filter((animal) => {
    const object = world.objects.find((object) => object.id === animal.id);
    return object && !assets[object.kind].behavior?.grazes;
  });
  const supported = insectEatersSupported(snapshot.food);
  const colonies = snapshot.food.filter((patch) => patch.capacity > 0).length;
  const struggling = world.objects.filter(
    (object) => plantCondition(object, world.environment)?.thriving === false,
  ).length;
  const notes = snapshot.discoveries.filter((note) =>
    world.objects.some((object) => object.id === note.animalId),
  );

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
          {paused ? (
            <Moon size={15} />
          ) : snapshot.phase === "day" ? (
            <Leaf size={15} />
          ) : (
            <Moon size={15} />
          )}
          {paused
            ? "Life paused"
            : snapshot.phase === "day"
              ? "A day in your world"
              : "After dark"}
        </span>
        <span>{animals.length + fishCount} inhabitants</span>
      </div>
      <h2>A little world, unfolding</h2>
      <p>
        {fishOnly
          ? "Two turns, a flash of color, and the school changes direction."
          : "Give them places to go. Then see what they get up to."}
      </p>
      {animals.length > 0 ? (
        <button className="life-follow" onClick={surpriseMe}>
          <Binoculars size={19} />
          Follow someone<span>Take a closer look</span>
        </button>
      ) : (
        <p>
          {fishCount
            ? "Each species keeps its own company, swimming at its own depth and pace. Arrange stones and driftwood, or shape the bottom to change where the schools can swim."
            : "Add a creature, some cover, and a little water to bring this world to life."}
        </p>
      )}
      {animals.length > 0 && (
        <div className="field-notebook">
          <h3>
            Field notes <span>Seen in this visit</span>
          </h3>
          {notes.length ? (
            <ul className="field-notes">
              {notes.map((note) => {
                const object = world.objects.find(
                  (object) => object.id === note.animalId,
                )!;
                const entry = fieldNotes[note.kind];
                return (
                  <li key={note.kind}>
                    <span className="field-note-mark">
                      {note.kind === "soak" ? (
                        <Waves size={17} />
                      ) : note.kind === "sleep" ? (
                        <Moon size={17} />
                      ) : (
                        <Leaf size={17} />
                      )}
                    </span>
                    <div>
                      <strong>{entry.title}</strong>
                      <p>
                        {assets[object.kind].name} · {entry.text}
                      </p>
                    </div>
                    <button
                      aria-label={`Follow ${assets[object.kind].name}: ${entry.title}`}
                      onClick={() => onWatch(object.id)}
                    >
                      <Eye size={17} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="field-notes-empty">
              {paused
                ? "Resume life to see what happens next."
                : "The first stories are still unfolding. Watch for a hunt, a climb, or a quiet spot to rest."}
            </p>
          )}
        </div>
      )}
      {animals.length > 0 && (
        <details className="life-details">
          <summary>
            Meet the inhabitants <span>{animals.length}</span>
          </summary>
          <CreatureList
            world={world}
            animals={animals}
            selectedId={selectedId}
            onWatch={onWatch}
          />
        </details>
      )}
      <details className="life-details">
        <summary>What makes this world work?</summary>
        {fishOnly ? (
          <p>
            Fish turn away from the tank walls and shallow ground. Deep water
            gives the schools room to explore; rocks and driftwood make the
            landscape yours. Fish don’t need feeding in this world.
          </p>
        ) : (
          <p>
            Plants and moss shelter insects. A shallow shoreline offers
            moisture. Leaves, logs, and dens give creatures places to climb and
            rest. Change the habitat and their choices change.
          </p>
        )}
        {eaters.length > supported ? (
          <p>
            More planted cover would help the insects keep up with your{" "}
            {eaters.length} insect eaters.
          </p>
        ) : colonies > 0 && eaters.length > 0 ? (
          <p>
            The cover here can support your insect eaters without feeding by
            hand.
          </p>
        ) : null}
        {animals.some((animal) => animal.needs.hydration < 0.4) && (
          <p>
            Some creatures are looking for moisture. A reachable, shallow
            shoreline gives them a place to soak.
          </p>
        )}
        {struggling > 0 && (
          <p>
            {struggling} {struggling === 1 ? "plant could" : "plants could"} use
            a better spot. Select a plant to see which soil it prefers.
          </p>
        )}
        {!fishOnly && (
          <p className="insect-summary">
            {Math.ceil(
              snapshot.food.reduce((sum, patch) => sum + patch.amount, 0),
            )}{" "}
            insects · {colonies} colonies · {eaters.length} insect eaters
          </p>
        )}
        {fishCount > 0 && !fishOnly && (
          <p>
            {fishCount} fish swim separately. They don’t compete for these
            insects.
          </p>
        )}
      </details>
    </section>
  );
}
