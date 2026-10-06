import { Sun, Sunset, Moon } from "lucide-react";
import type { Editor } from "../editor/useEditor";
import { RangeControl } from "./RangeControl";
export function EnvironmentPanel({ editor }: { editor: Editor }) {
  const env = editor.world.environment;
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
      <div className="section-label">THE ENCLOSURE</div>
      <RangeControl
        label="Tank width"
        value={env.width}
        min={5}
        max={9}
        step={0.5}
        format={(n) => `${Math.round(n * 10)} cm`}
        onPreview={(width) => editor.previewEnvironment({ width })}
        onCommit={(width) => editor.changeEnvironment({ width })}
      />
      <RangeControl
        label="Tank depth"
        value={env.depth}
        min={3}
        max={6}
        step={0.5}
        format={(n) => `${Math.round(n * 10)} cm`}
        onPreview={(depth) => editor.previewEnvironment({ depth })}
        onCommit={(depth) => editor.changeEnvironment({ depth })}
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
      <RangeControl
        label="Water level"
        value={env.water}
        min={0}
        max={0.9}
        step={0.01}
        format={(n) => (n === 0 ? "Dry" : `${(n * 10).toFixed(1)} cm`)}
        onPreview={(water) => editor.previewEnvironment({ water })}
        onCommit={(water) => editor.changeEnvironment({ water })}
      />
      <p className="panel-note">
        The bank rises on the left; a pool collects on the right. Water reveals
        the shape of your shoreline.
      </p>
      <div className="section-label">A LIVING SCENE</div>
      <p className="panel-note">
        Insects breed under plants and moss, and frogs hunt them. A well-planted
        tank feeds its frogs on its own. Fish school together in open water.
      </p>
    </div>
  );
}
