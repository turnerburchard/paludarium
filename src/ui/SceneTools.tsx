import { Eye, Hammer, Maximize2, Pause, Play } from "lucide-react";
import type { Editor } from "../editor/useEditor";
import { IconButton } from "./IconButton";

export function SceneTools({
  editor,
  view,
  onChangeMode,
  onResetCamera,
}: {
  editor: Editor;
  view: boolean;
  onChangeMode: (view: boolean) => void;
  onResetCamera: () => void;
}) {
  return (
    <>
      <nav className="mode-switch" aria-label="World mode">
        <button aria-pressed={view} onClick={() => onChangeMode(true)}>
          <Eye size={16} /> View
        </button>
        <button aria-pressed={!view} onClick={() => onChangeMode(false)}>
          <Hammer size={16} /> Build
        </button>
      </nav>
      <div className="scene-tools">
        <IconButton
          label={editor.paused ? "Resume life (Space)" : "Pause life (Space)"}
          onClick={() => editor.setPaused((p) => !p)}
          active={editor.paused}
        >
          {editor.paused ? <Play size={19} /> : <Pause size={19} />}
        </IconButton>
        <IconButton label="Reset camera" onClick={onResetCamera}>
          <Maximize2 size={19} />
        </IconButton>
      </div>
    </>
  );
}
