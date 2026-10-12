import type { ReactNode } from "react";
import type { Editor } from "../editor/useEditor";
import type { TerrainBrush } from "../model/terrainBrush";
import { shapeTools, paintTools, type TerrainTool } from "./terrainTools";
import { RangeControl } from "./RangeControl";
import "./TerrainControls.css";

export function TerrainControls({ editor }: { editor: Editor }) {
  return (
    <section className="terrain-controls" aria-label="Landscape brushes">
      <div className="section-label">LANDSCAPE</div>
      <div className="tile-grid shape-tools">
        {shapeTools.map(({ Icon, ...tool }) => (
          <BrushTile key={tool.mode} editor={editor} tool={tool}>
            <Icon size={16} />
          </BrushTile>
        ))}
      </div>
      <div className="tile-grid">
        {paintTools.map(({ color, ...tool }) => (
          <BrushTile key={tool.mode} editor={editor} tool={tool}>
            <span className="swatch" style={{ background: color }} />
          </BrushTile>
        ))}
      </div>
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

function BrushTile({
  editor,
  tool,
  children,
}: {
  editor: Editor;
  tool: TerrainTool;
  children: ReactNode;
}) {
  const brush = editor.tool.type === "terrain" ? editor.tool : null;
  return (
    <button
      className="tile"
      aria-pressed={brush?.mode === tool.mode}
      aria-label={tool.label}
      title={tool.description}
      onClick={() => {
        editor.select(null);
        // Switching brushes keeps the size picked for the last one.
        editor.setTool({
          type: "terrain",
          mode: tool.mode,
          radius: brush?.radius ?? 0.4,
        });
      }}
    >
      {children}
      {tool.name}
    </button>
  );
}

/** The active brush's size, shown in the bar while brushing. */
export function BrushSettings({
  editor,
  brush,
}: {
  editor: Editor;
  brush: TerrainBrush;
}) {
  return (
    <div className="tool-settings">
      <RangeControl
        label="Brush size"
        value={brush.radius}
        min={0.2}
        max={1.2}
        step={0.05}
        format={(n) => `${(n * 20).toFixed(0)} cm`}
        onCommit={(radius) =>
          editor.setTool({ type: "terrain", ...brush, radius })
        }
      />
    </div>
  );
}
