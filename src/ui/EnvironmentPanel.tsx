import { useRef } from "react";
import type { Editor } from "../editor/useEditor";
import { RangeControl } from "./RangeControl";
import { TerrainControls } from "./TerrainControls";
import { AddSpring } from "./SpringControls";
import {
  waterCeiling,
  MIN_TANK_HEIGHT,
  MAX_TANK_HEIGHT,
} from "../model/terrainData";
import { MAX_TANK_DEPTH, MAX_TANK_WIDTH } from "../model/schema";

/** Ordered by how often each part is reached for while building: the
 * landscape brushes first, the tank and its light last and folded away. */
export function EnvironmentPanel({ editor }: { editor: Editor }) {
  const env = editor.world.environment;
  const pausedBeforeDrag = useRef<boolean | null>(null);
  return (
    <div className="environment-panel">
      <TerrainControls editor={editor} />
      <div className="section-label">WATER</div>
      <RangeControl
        label="Water level"
        value={env.water}
        min={0}
        max={waterCeiling(env)}
        step={0.01}
        format={(n) => (n === 0 ? "Dry" : `${(n * 10).toFixed(1)} cm`)}
        onPreview={(water) => {
          // Life runs on the saved world, so while the level is only previewed
          // fish would keep swimming in water that isn't shown. Hold it still.
          pausedBeforeDrag.current ??= editor.paused;
          editor.setPaused(true);
          editor.previewEnvironment({ water });
        }}
        onCommit={(water) => {
          editor.changeEnvironment({ water });
          editor.setPaused(pausedBeforeDrag.current ?? editor.paused);
          pausedBeforeDrag.current = null;
        }}
      />
      <AddSpring editor={editor} />
      <details className="more-options">
        <summary>TANK</summary>
        <RangeControl
          label="Width"
          value={env.width}
          min={5}
          max={MAX_TANK_WIDTH}
          step={0.5}
          format={(n) => `${Math.round(n * 10)} cm`}
          onPreview={(width) => editor.previewEnvironment({ width })}
          onCommit={(width) => editor.changeEnvironment({ width })}
        />
        <RangeControl
          label="Depth"
          value={env.depth}
          min={3}
          max={MAX_TANK_DEPTH}
          step={0.5}
          format={(n) => `${Math.round(n * 10)} cm`}
          onPreview={(depth) => editor.previewEnvironment({ depth })}
          onCommit={(depth) => editor.changeEnvironment({ depth })}
        />
        <RangeControl
          label="Height"
          value={env.height}
          min={MIN_TANK_HEIGHT}
          max={MAX_TANK_HEIGHT}
          step={0.1}
          format={(n) => `${Math.round(n * 10)} cm`}
          onPreview={(height) => {
            pausedBeforeDrag.current ??= editor.paused;
            editor.setPaused(true);
            editor.previewEnvironment({ height });
          }}
          onCommit={(height) => {
            editor.changeEnvironment({ height });
            editor.setPaused(pausedBeforeDrag.current ?? editor.paused);
            pausedBeforeDrag.current = null;
          }}
        />
        <RangeControl
          label="Soil depth"
          value={env.substrate}
          min={0.12}
          max={0.55}
          step={0.01}
          format={(n) => `${(n * 10).toFixed(1)} cm`}
          onPreview={(substrate) => editor.previewEnvironment({ substrate })}
          onCommit={(substrate) => editor.changeEnvironment({ substrate })}
        />
      </details>
      <details className="more-options">
        <summary>LIGHT</summary>
        <RangeControl
          label="Brightness"
          value={env.brightness}
          min={0.4}
          max={1.6}
          step={0.05}
          format={(n) => `${Math.round(n * 100)}%`}
          onPreview={(brightness) => editor.previewEnvironment({ brightness })}
          onCommit={(brightness) => editor.changeEnvironment({ brightness })}
        />
        <RangeControl
          label="Warmth"
          value={env.warmth}
          min={0}
          max={1}
          step={0.05}
          format={(n) => (n < 0.35 ? "Cool" : n > 0.65 ? "Warm" : "Neutral")}
          onPreview={(warmth) => editor.previewEnvironment({ warmth })}
          onCommit={(warmth) => editor.changeEnvironment({ warmth })}
        />
      </details>
    </div>
  );
}
