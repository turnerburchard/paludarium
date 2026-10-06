import type { Activity, AnimalState } from "../simulation/types";

export const activityLabels: Record<Activity, string> = {
  exploring: "Exploring",
  "seeking-food": "Looking for insects",
  eating: "Eating insects",
  "seeking-water": "Heading to the shoreline",
  bathing: "Soaking",
  "seeking-shelter": "Finding a resting spot",
  sleeping: "Sleeping",
  resting: "Resting",
};

/** What an animal is doing, why, and how its needs stand. */
export function AnimalStatus({ animal }: { animal: AnimalState }) {
  const needs = [
    ["Fullness", 1 - animal.needs.hunger],
    ["Hydration", animal.needs.hydration],
    ["Energy", animal.needs.energy],
  ] as const;
  return (
    <>
      <strong>{activityLabels[animal.activity]}</strong>
      <p>{animal.reason}</p>
      <div className="life-needs">
        {needs.map(([label, value]) => (
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
  );
}
