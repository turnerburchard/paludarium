import {
  Check,
  Eye,
  Globe2,
  Hammer,
  Info,
  Pause,
  Play,
  Redo2,
  Share2,
  Undo2,
} from "lucide-react";
import type { Editor } from "../editor/useEditor";
import { IconButton } from "./IconButton";

/** One header for both modes, so switching never moves a control. Build
 * adds the world name, and Undo and Redo at the start of the actions. */
export function TopBar({
  editor,
  view,
  onChangeMode,
  onWorlds,
  onShare,
  onAbout,
}: {
  editor: Editor;
  view: boolean;
  onChangeMode: (view: boolean) => void;
  onWorlds: () => void;
  onShare: () => void;
  onAbout: () => void;
}) {
  const { world } = editor;

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">
          <img src="./paludarium-mark-light.svg" alt="" />
        </span>
        <h1>paludarium</h1>
      </div>
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
      {!view && (
        <div className="world-title">
          <input
            aria-label="World name"
            key={world.name}
            defaultValue={world.name}
            maxLength={60}
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (name) editor.rename(name);
              else e.target.value = world.name;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          <span
            className={editor.saved ? "save-status" : "save-status warning"}
          >
            {editor.saved ? <Check size={12} /> : null}
            {editor.saving
              ? "Saving…"
              : editor.saved
                ? "Saved on this device"
                : "Save unavailable"}
          </span>
        </div>
      )}
      <div className="header-actions">
        {!view && (
          <>
            <IconButton
              label="Undo (⌘/Ctrl Z)"
              onClick={editor.undo}
              disabled={!editor.canUndo}
            >
              <Undo2 size={18} />
            </IconButton>
            <span className="desktop-redo">
              <IconButton
                label="Redo (⌘/Ctrl Shift Z)"
                onClick={editor.redo}
                disabled={!editor.canRedo}
              >
                <Redo2 size={18} />
              </IconButton>
            </span>
          </>
        )}
        <span className="life-toggle">
          <IconButton
            label={editor.paused ? "Resume life (Space)" : "Pause life (Space)"}
            onClick={() => editor.setPaused((p) => !p)}
            active={editor.paused}
          >
            {editor.paused ? <Play size={18} /> : <Pause size={18} />}
          </IconButton>
        </span>
        <button
          className="worlds-button"
          aria-label="Worlds"
          title="Worlds"
          onClick={onWorlds}
        >
          <Globe2 size={18} aria-hidden="true" /> <span>Worlds</span>
        </button>
        <IconButton label="Share this world" onClick={onShare}>
          <Share2 size={18} />
        </IconButton>
        <IconButton label="About Paludarium" onClick={onAbout}>
          <Info size={18} />
        </IconButton>
      </div>
    </header>
  );
}
