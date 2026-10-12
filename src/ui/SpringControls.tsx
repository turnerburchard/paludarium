import { Plus, Trash2 } from "lucide-react";
import { MAX_SPRINGS } from "../model/schema";
import type { Editor } from "../editor/useEditor";
import { RangeControl } from "./RangeControl";
import "./SpringControls.css";

/** Springs are the only running water: each wells up where it's placed and
 * runs downhill, filling the hollows on its way. A placed spring is changed
 * by tapping it in the tank. */
export function AddSpring({ editor }: { editor: Editor }) {
  const { tool } = editor;
  return (
    <button
      className="tile add-spring"
      aria-pressed={tool.type === "spring" && tool.index === null}
      disabled={editor.world.environment.springs.length >= MAX_SPRINGS}
      onClick={() => {
        editor.select(null);
        editor.setTool({ type: "spring", index: null });
      }}
    >
      <Plus size={16} />
      Add spring
    </button>
  );
}

/** The chosen spring's flow, shown in the bar once it is tapped. */
export function SpringSettings({
  editor,
  index,
}: {
  editor: Editor;
  index: number;
}) {
  const { springs } = editor.world.environment;
  const withFlow = (flow: number) =>
    springs.map((s, i) => (i === index ? { ...s, flow } : s));
  return (
    <div className="tool-settings">
      <RangeControl
        label="Flow"
        value={springs[index].flow}
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
        onClick={() => editor.removeSpring(index)}
      >
        <Trash2 size={16} />
        Remove
      </button>
    </div>
  );
}
