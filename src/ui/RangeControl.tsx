import { useEffect, useState, type SyntheticEvent } from "react";
interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (n: number) => string;
  /** Called continuously while dragging, to show the change live. */
  onPreview?: (n: number) => void;
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
  onPreview,
  onCommit,
}: Props) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  // Always commit on release: it also ends any preview. Committing an
  // unchanged value adds nothing to history.
  const commit = (event: SyntheticEvent<HTMLInputElement>) =>
    onCommit(Number(event.currentTarget.value));
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
        onChange={(e) => {
          const next = Number(e.target.value);
          setDraft(next);
          onPreview?.(next);
        }}
        onPointerUp={commit}
        onPointerCancel={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
    </label>
  );
}
