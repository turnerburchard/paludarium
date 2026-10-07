import { useState } from "react";
import type { Editor } from "../editor/useEditor";
import { terrainTools } from "./terrainTools";
import { RangeControl } from "./RangeControl";
import "./TerrainControls.css";

export function TerrainControls({ editor }: { editor: Editor }) {
  const [radius, setRadius] = useState(0.65);
  const brush = editor.tool.type === "terrain" ? editor.tool : null;
  const selected = terrainTools.find(({ mode }) => mode === brush?.mode);
  return (
    <section className="terrain-controls" aria-label="Landscape brushes">
      <div className="section-label">SHAPE YOUR LANDSCAPE</div>
      <div className="terrain-tools">
        {terrainTools.map(({ mode, label, description }) => (
          <button
            key={mode}
            className={brush?.mode === mode ? "active" : ""}
            aria-pressed={brush?.mode === mode}
            title={description}
            onClick={() => {
              editor.select(null);
              editor.setTool({
                type: "terrain",
                mode,
                radius,
              });
              editor.notify(`${label}. ${description}`);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="terrain-note" aria-live="polite">
        {selected?.description ??
          "Choose a brush to shape or paint the ground."}
      </p>
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
        Drag to brush, tap for a small change. Each stroke is one undo. Done or
        Escape finishes.
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
