import { useEffect, useRef } from "react";
import { RotateCcw, RotateCw } from "lucide-react";
import type { Editor } from "../editor/useEditor";

function TurnButton({
  left = false,
  onTurn,
}: {
  left?: boolean;
  onTurn: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function stop() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }
  useEffect(() => stop, []);
  function turn(repeating = false) {
    onTurn();
    timer.current = setTimeout(() => turn(true), repeating ? 100 : 350);
  }
  return (
    <button
      aria-label={left ? "Turn placement left" : "Turn placement right"}
      title="Tap to turn, hold to spin"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        stop();
        event.currentTarget.setPointerCapture(event.pointerId);
        turn();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onBlur={stop}
      onKeyDown={(event) => {
        // Space activates this button instead of the global pause shortcut.
        if (event.key === " ") event.stopPropagation();
      }}
      onClick={(event) => {
        if (event.detail === 0) onTurn();
      }}
    >
      {left ? <RotateCcw size={18} /> : <RotateCw size={18} />}
      {left ? "Left" : "Right"}
    </button>
  );
}

export function PlacementRotation({ editor }: { editor: Editor }) {
  const degrees =
    ((Math.round((editor.placementRotation * 180) / Math.PI) % 360) + 360) %
    360;
  return (
    <div className="placement-rotation" aria-label="Placement rotation">
      <TurnButton left onTurn={() => editor.rotate(-Math.PI / 12)} />
      <output aria-label="Placement angle">{degrees}°</output>
      <TurnButton onTurn={() => editor.rotate(Math.PI / 12)} />
      <span>Tap to turn · hold to spin</span>
    </div>
  );
}
