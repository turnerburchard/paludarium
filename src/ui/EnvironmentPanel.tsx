import { useRef } from "react";
import { Sun, Sunset, Moon } from "lucide-react";
import type { Editor } from "../editor/useEditor";
import { RangeControl } from "./RangeControl";
import { TerrainControls } from "./TerrainControls";
import { SpringControls } from "./SpringControls";
import {
  waterCeiling,
  MIN_TANK_HEIGHT,
  MAX_TANK_HEIGHT,
} from "../model/terrainData";
import { MAX_TANK_DEPTH, MAX_TANK_WIDTH } from "../model/schema";

export function EnvironmentPanel({ editor }: { editor: Editor }) {
  const env = editor.world.environment;
  const pausedBeforeDrag = useRef<boolean | null>(null);
  return (
    <div className="environment-panel">
      <div className="section-label">LIGHT & ATMOSPHERE</div>
      <div className="light-options">
        {(
          [
            { key: "day", name: "Daylight", Icon: Sun },
            { key: "golden", name: "Golden", Icon: Sunset },
            { key: "moon", name: "Moonlight", Icon: Moon },
          ] as const
        ).map(({ key, name, Icon }) => (
          <button
            key={key}
            className={env.light === key ? "active" : ""}
            onClick={() =>
              editor.changeEnvironment({
                light: key,
                warmth: key === "golden" ? 0.9 : key === "moon" ? 0.1 : 0.45,
              })
            }
            aria-pressed={env.light === key}
          >
            <Icon size={21} />
            {name}
          </button>
        ))}
      </div>
      <div className="section-label">WATER</div>
      <div className="water-options">
        {[
          { name: "Dry", water: 0 },
          { name: "Shallow", water: 0.44 },
          { name: "Full", water: waterCeiling(env) },
        ].map(({ name, water }) => (
          <button
            key={name}
            aria-pressed={Math.abs(env.water - water) < 0.005}
            onClick={() => editor.changeEnvironment({ water })}
          >
            {name}
          </button>
        ))}
      </div>
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
      <SpringControls editor={editor} />
      <details className="more-options landscape-options">
        <summary>Shape landscape</summary>
        <TerrainControls editor={editor} />
      </details>
      <details className="more-options">
        <summary>Fine-tune habitat</summary>
        <RangeControl
          label="Light warmth"
          value={env.warmth}
          min={0}
          max={1}
          step={0.05}
          format={(n) => (n < 0.35 ? "Cool" : n > 0.65 ? "Warm" : "Neutral")}
          onPreview={(warmth) => editor.previewEnvironment({ warmth })}
          onCommit={(warmth) => editor.changeEnvironment({ warmth })}
        />
        <RangeControl
          label="Light brightness"
          value={env.brightness}
          min={0.4}
          max={1.6}
          step={0.05}
          format={(n) => `${Math.round(n * 100)}%`}
          onPreview={(brightness) => editor.previewEnvironment({ brightness })}
          onCommit={(brightness) => editor.changeEnvironment({ brightness })}
        />
        <RangeControl
          label="Tank width"
          value={env.width}
          min={5}
          max={MAX_TANK_WIDTH}
          step={0.5}
          format={(n) => `${Math.round(n * 10)} cm`}
          onPreview={(width) => editor.previewEnvironment({ width })}
          onCommit={(width) => editor.changeEnvironment({ width })}
        />
        <RangeControl
          label="Tank depth"
          value={env.depth}
          min={3}
          max={MAX_TANK_DEPTH}
          step={0.5}
          format={(n) => `${Math.round(n * 10)} cm`}
          onPreview={(depth) => editor.previewEnvironment({ depth })}
          onCommit={(depth) => editor.changeEnvironment({ depth })}
        />
        <RangeControl
          label="Tank height"
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
    </div>
  );
}
