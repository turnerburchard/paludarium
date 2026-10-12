import { MOSS_COLORS } from "../assets/landscape/mosses";
import { mossSpecies, type MossSpecies } from "../model/moss";

const mossNames: Record<MossSpecies, string> = {
  sheet: "Sheet",
  cushion: "Cushion",
  fern: "Fern",
  java: "Java",
};

/** Bare, or one of the mosses, with a swatch of each green. */
export function MossPicker({
  value,
  onChange,
}: {
  value?: MossSpecies;
  onChange: (moss?: MossSpecies) => void;
}) {
  return (
    <div className="moss-options" role="group" aria-label="Moss">
      <span className="section-label">MOSS</span>
      <div className="tile-grid">
        {[undefined, ...mossSpecies].map((species) => (
          <button
            key={species ?? "none"}
            className="tile"
            aria-pressed={value === species}
            onClick={() => onChange(species)}
          >
            <span
              className={species ? "swatch" : "swatch bare"}
              style={{
                background: species ? MOSS_COLORS[species][0] : undefined,
              }}
            />
            {species ? mossNames[species] : "Bare"}
          </button>
        ))}
      </div>
    </div>
  );
}
