import { useRef } from "react";
import {
  Check,
  Download,
  Leaf,
  Plus,
  Redo2,
  Undo2,
  Upload,
} from "lucide-react";
import type { Editor } from "../editor/useEditor";
import { downloadWorld, parseWorld } from "../editor/persistence";
import { IconButton } from "./IconButton";

export function TopBar({
  editor,
  onNewWorld,
}: {
  editor: Editor;
  onNewWorld: () => void;
}) {
  const { world } = editor;
  const importInput = useRef<HTMLInputElement>(null);

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 250_000)
        throw new Error("This file is too large for a terrarium.");
      editor.replaceWorld(parseWorld(await file.text()));
      editor.notify("Your world is ready.");
    } catch (error) {
      editor.notify(
        error instanceof Error ? error.message : "Could not import this file.",
      );
    }
    if (importInput.current) importInput.current.value = "";
  }

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">
          <Leaf size={23} />
        </span>
        <div>
          <h1>
            Paludarium<span> / </span>
          </h1>
          <span className="brand-caption">TERRARIUM STUDIO</span>
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
            if (name) editor.replaceWorld({ ...world, name });
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
              : "Save unavailable · export a copy"}
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
        <span className="divider" />
        <IconButton label="Export world" onClick={() => downloadWorld(world)}>
          <Download size={18} />
        </IconButton>
        <IconButton
          label="Import world"
          onClick={() => importInput.current?.click()}
        >
          <Upload size={18} />
        </IconButton>
        <button
          className="new-world"
          onClick={onNewWorld}
          aria-label="New world"
          title="New world"
        >
          <Plus size={16} />
          <span>New world</span>
        </button>
      </div>
      <input
        ref={importInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => void importFile(e.target.files?.[0])}
      />
    </header>
  );
}
