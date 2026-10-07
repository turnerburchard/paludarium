import type { Preset } from "../model/presets";

export function EmptyInvitation({
  onPreset,
}: {
  onPreset: (preset: Preset) => void;
}) {
  return (
    <div className="empty-invitation">
      <span className="eyebrow">A SMALL BEGINNING</span>
      <h2>
        Make room for
        <br />a little life.
      </h2>
      <p>
        Plant the first leaf, place a stone,
        <br />
        then find a home for a creature.
      </p>
      <div>
        <button onClick={() => onPreset("tropical")}>Try a cloud forest</button>
        <button className="text-button" onClick={() => onPreset("mountain")}>
          Or an alpine creek
        </button>
      </div>
    </div>
  );
}
