import type { EcosystemController } from "../simulation/useEcosystem";
import type { Activity } from "../simulation/types";
const labels: Record<Activity, string> = {
  exploring: "Exploring",
  "seeking-food": "Looking for insects",
  eating: "Eating insects",
  "seeking-water": "Heading to the shoreline",
  bathing: "Soaking",
  "seeking-shelter": "Finding a resting spot",
  sleeping: "Sleeping",
  resting: "Resting",
};
export function LifePanel({
  ecosystem,
  selectedId,
  paused,
}: {
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
  const food = snapshot.food.reduce((sum, p) => sum + p.amount, 0);
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
        <span>{snapshot.animals.length} frogs</span>
      </div>
      {animal ? (
        <>
          <strong>{labels[animal.activity]}</strong>
          <p>{animal.reason}</p>
          <div className="life-needs">
            {(
              [
                ["Fullness", 1 - animal.needs.hunger],
                ["Hydration", animal.needs.hydration],
                ["Energy", animal.needs.energy],
              ] as const
            ).map(([label, value]) => (
              <label key={label}>
                <span>{label}</span>
                <meter
                  aria-label={label}
                  min={0}
                  max={1}
                  low={0.3}
                  high={0.7}
                  optimum={1}
                  value={value}
                />
              </label>
            ))}
          </div>
        </>
      ) : (
        <p>
          {thirsty
            ? `${thirsty} ${thirsty === 1 ? "frog needs" : "frogs need"} moisture.`
            : hungry
              ? `${hungry} ${hungry === 1 ? "frog is" : "frogs are"} hungry.`
              : "Select a frog to see its activity and needs."}
        </p>
      )}
      <div className="life-actions">
        <button onClick={ecosystem.feed}>Scatter insects</button>
        <button onClick={ecosystem.mist}>Mist habitat</button>
      </div>
      <small>
        {food > 0
          ? `${Math.ceil(food)} insect portions on the bank`
          : "Food has run out"}{" "}
        · live session
      </small>
    </section>
  );
}
