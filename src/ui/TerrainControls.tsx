import { useState } from "react";
import type { Editor } from "../editor/useEditor";
import { terrainTools } from "./terrainTools";
import { RangeControl } from "./RangeControl";
import "./TerrainControls.css";

export function TerrainControls({ editor }: { editor: Editor }) {
  const [radius, setRadius] = useState(0.65);
  const brush = editor.tool.type === "terrain" ? editor.tool : null;
  return (
    <section className="terrain-controls" aria-label="Landscape brushes">
      <div className="section-label">SHAPE YOUR LANDSCAPE</div>
      <div className="terrain-tools">
        {terrainTools.map(({ mode, label }) => (
          <button
            key={mode}
            className={brush?.mode === mode ? "active" : ""}
            aria-pressed={brush?.mode === mode}
            onClick={() => {
              editor.select(null);
              editor.setTool({
                type: "terrain",
                mode,
                radius: mode === "stream" ? Math.min(radius, 0.35) : radius,
              });
              editor.notify(
                `${label}. Drag across the tank; Done or Escape finishes.`,
              );
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <RangeControl
        label="Brush size"
        value={brush?.radius ?? radius}
        min={0.2}
        max={1.2}
        step={0.05}
        format={(n) => `${(n * 20).toFixed(0)} cm`}
        onCommit={(next) => {
          setRadius(next);
          if (brush) editor.setTool({ ...brush, radius: next });
        }}
      />
      <p className="terrain-note">
        Drag to brush, tap for a small change. Each stroke is one undo. Pools
        and streams fill to the water level.
      </p>
      <button
        className="reset-terrain"
        disabled={!editor.world.environment.terrain}
        onClick={() => editor.changeEnvironment({ terrain: undefined })}
      >
        Reset landscape
      </button>
    </section>
  );
}
