import { MAX_SPRINGS } from "../model/schema";
import type { Editor } from "../editor/useEditor";
import { RangeControl } from "./RangeControl";
import "./SpringControls.css";

/** Springs are the only running water: each wells up where it's placed and
 * runs downhill, filling the hollows on its way. */
export function SpringControls({ editor }: { editor: Editor }) {
  const { springs } = editor.world.environment;
  const { tool } = editor;
  const adding = tool.type === "spring" && tool.index === null;
  const chosen = tool.type === "spring" ? tool.index : null;
  const withFlow = (flow: number) =>
    springs.map((s, i) => (i === chosen ? { ...s, flow } : s));
  return (
    <section className="spring-controls" aria-label="Springs">
      <div className="water-options spring-list">
        {springs.map((_, i) => (
          <button
            key={i}
            aria-pressed={chosen === i}
            onClick={() => {
              editor.select(null);
              editor.setTool({ type: "spring", index: i });
            }}
          >
            Spring {i + 1}
          </button>
        ))}
        <button
          aria-pressed={adding}
          disabled={springs.length >= MAX_SPRINGS}
          onClick={() => {
            editor.select(null);
            editor.setTool({ type: "spring", index: null });
          }}
        >
          Add spring
        </button>
      </div>
      {chosen !== null && (
        <>
          <RangeControl
            label="Flow"
            value={springs[chosen].flow}
            min={0}
            max={1}
            step={0.05}
            format={(n) => (n < 0.3 ? "Trickle" : n > 0.7 ? "Gush" : "Steady")}
            onPreview={(flow) =>
              editor.previewEnvironment({ springs: withFlow(flow) })
            }
            onCommit={(flow) =>
              editor.changeEnvironment({ springs: withFlow(flow) })
            }
          />
          <button
            className="remove-spring"
            onClick={() => editor.removeSpring(chosen)}
          >
            Remove spring
          </button>
        </>
      )}
    </section>
  );
}
