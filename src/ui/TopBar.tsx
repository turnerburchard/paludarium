import { Check, FolderOpen, Leaf, Redo2, Undo2 } from "lucide-react";
import type { Editor } from "../editor/useEditor";
import { IconButton } from "./IconButton";

export function TopBar({
  editor,
  onWorlds,
}: {
  editor: Editor;
  onWorlds: () => void;
}) {
  const { world } = editor;

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">
          <Leaf size={23} />
        </span>
        <div>
          <h1>Paludarium</h1>
        </div>
      </div>
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
        <span className={editor.saved ? "save-status" : "save-status warning"}>
          {editor.saved ? <Check size={12} /> : null}
          {editor.saving
            ? "Saving…"
            : editor.saved
              ? "Saved on this device"
              : "Save unavailable"}
        </span>
      </div>
      <div className="header-actions">
        <IconButton
          label="Undo (⌘/Ctrl Z)"
          onClick={editor.undo}
          disabled={!editor.canUndo}
        >
          <Undo2 size={18} />
        </IconButton>
        <IconButton
          label="Redo (⌘/Ctrl Shift Z)"
          onClick={editor.redo}
          disabled={!editor.canRedo}
        >
          <Redo2 size={18} />
        </IconButton>
        <IconButton label="My worlds" onClick={onWorlds}>
          <FolderOpen size={18} />
        </IconButton>
      </div>
    </header>
  );
}
