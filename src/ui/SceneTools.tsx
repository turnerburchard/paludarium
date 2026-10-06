import { ArrowLeft, Eye, Maximize2, Pause, Play } from "lucide-react";
import type { Editor } from "../editor/useEditor";
import { IconButton } from "./IconButton";

export function SceneTools({
  editor,
  view,
  onToggleView,
  onResetCamera,
}: {
  editor: Editor;
  view: boolean;
  onToggleView: () => void;
  onResetCamera: () => void;
}) {
  return (
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
      <IconButton
        label={view ? "Return to building" : "Watch your world"}
        onClick={onToggleView}
        active={view}
      >
        {view ? <ArrowLeft size={19} /> : <Eye size={19} />}
      </IconButton>
    </div>
  );
}
