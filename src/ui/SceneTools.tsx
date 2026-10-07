import { Share2, Globe2, Eye, Hammer, Home, Pause, Play } from "lucide-react";
import type { Editor } from "../editor/useEditor";
import { IconButton } from "./IconButton";

export function SceneTools({
  editor,
  view,
  onChangeMode,
  onResetCamera,
  onWorlds,
  onShare,
}: {
  editor: Editor;
  view: boolean;
  onChangeMode: (view: boolean) => void;
  onResetCamera: () => void;
  onWorlds: () => void;
  onShare: () => void;
}) {
  return (
    <div className="scene-controls">
      <nav className="mode-switch" aria-label="World mode">
        <button
          aria-label="View"
          title="View"
          aria-pressed={view}
          onClick={() => onChangeMode(true)}
        >
          <Eye size={16} /> <span>View</span>
        </button>
        <button
          aria-label="Build"
          title="Build"
          aria-pressed={!view}
          onClick={() => onChangeMode(false)}
        >
          <Hammer size={16} /> <span>Build</span>
        </button>
      </nav>
      <div className="scene-tools">
        {view && (
          <button
            className="worlds-button"
            aria-label="Worlds"
            title="Worlds"
            onClick={onWorlds}
          >
            <Globe2 size={18} aria-hidden="true" /> <span>Worlds</span>
          </button>
        )}
        <IconButton
          label={editor.paused ? "Resume life (Space)" : "Pause life (Space)"}
          onClick={() => editor.setPaused((p) => !p)}
          active={editor.paused}
        >
          {editor.paused ? <Play size={19} /> : <Pause size={19} />}
        </IconButton>
        <IconButton label="Reset view" onClick={onResetCamera}>
          <Home size={19} />
        </IconButton>
        <IconButton label="Share this world" onClick={onShare}>
          <Share2 size={19} />
        </IconButton>
      </div>
    </div>
  );
}
