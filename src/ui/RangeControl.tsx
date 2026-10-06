import { useEffect, useState, type SyntheticEvent } from "react";
interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (n: number) => string;
  onCommit: (n: number) => void;
}
/** Keep slider gestures out of history until release, so Undo reverses the whole gesture. */
export function RangeControl({
  label,
  value,
  min,
  max,
  step,
  format,
  onCommit,
}: Props) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = (event: SyntheticEvent<HTMLInputElement>) => {
    const next = Number(event.currentTarget.value);
    if (next !== value) onCommit(next);
  };
  return (
    <label className="range-control">
      <span>
        {label}
        <output>{format ? format(draft) : draft.toFixed(1)}</output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
    </label>
  );
}
