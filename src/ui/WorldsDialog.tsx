import { useState } from "react";
import {
  Download,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { Editor } from "../editor/useEditor";
import { downloadWorld } from "../editor/persistence";
import type { Preset } from "../model/presets";
import { IconButton } from "./IconButton";
import { Modal } from "./Modal";
import { RenameDialog } from "./RenameDialog";

export function WorldsDialog({
  editor,
  onOpen,
  onPreset,
  onImport,
  importError,
  onClose,
}: {
  editor: Editor;
  onOpen: (id: string) => void;
  onPreset: (preset: Preset) => void;
  onImport: () => void;
  importError: string;
  onClose: () => void;
}) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const savedWorlds = editor.library.worlds.filter((entry) => !entry.preview);
  const renaming = savedWorlds.find((entry) => entry.id === renameId);
  if (renaming)
    return (
      <RenameDialog
        title="Rename world"
        name={renaming.world.name}
        maxLength={60}
        onSave={(name) => {
          // A failed save shows its error back in the Worlds list.
          if (name) editor.renameWorld(renaming.id, name);
          setRenameId(null);
        }}
        onClose={() => setRenameId(null)}
      />
    );
  return (
    <Modal label="Worlds" onClose={onClose}>
      <div className="modal-heading worlds-heading">
        <h2>Worlds</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      {(editor.saveError || !editor.saved) && (
        <p role="status">
          {editor.saveError ||
            "Saving is unavailable. To keep a copy, open a world's options and choose Export."}
        </p>
      )}
      <h3 className="world-section-heading">Presets</h3>
      <div className="preset-options">
        <button onClick={() => onPreset("tropical")}>Cloud forest</button>
        <button onClick={() => onPreset("amazon")}>Amazon river</button>
        <button onClick={() => onPreset("mountain")}>Alpine creek</button>
        <button onClick={() => onPreset("desert")}>Desert spring</button>
        <button onClick={() => onPreset("grotto")}>Limestone grotto</button>
        <button onClick={() => onPreset("island")}>Tropical island</button>
        <button onClick={() => onPreset("empty")}>Empty tank</button>
      </div>
      <div className="world-library-actions">
        <h3 className="world-section-heading">Your worlds</h3>
        <button onClick={onImport}>
          <Upload size={15} aria-hidden="true" /> Import
        </button>
      </div>
      {importError && <p role="status">{importError}</p>}
      <div className="world-list">
        {savedWorlds.map(({ id, world }) => (
          <div className="saved-world" key={id}>
            <div className="saved-world-heading">
              <button className="open-world" onClick={() => onOpen(id)}>
                <strong>{world.name}</strong>
                {id === editor.library.activeId && <span>Current</span>}
              </button>
              <IconButton
                label={`Options for ${world.name}`}
                onClick={() => {
                  setMenuId(menuId === id ? null : id);
                  setDeleteId(null);
                }}
              >
                <MoreHorizontal size={18} />
              </IconButton>
            </div>
            {menuId === id && (
              <div className="world-options">
                <button
                  onClick={() => {
                    setRenameId(id);
                    setMenuId(null);
                  }}
                >
                  <Pencil size={15} aria-hidden="true" /> Rename
                </button>
                <button onClick={() => downloadWorld(world)}>
                  <Download size={15} aria-hidden="true" /> Export
                </button>
                {editor.library.worlds.length > 1 &&
                  (deleteId === id ? (
                    <>
                      <span>Delete this world permanently?</span>
                      <button
                        className="delete-world"
                        onClick={() => {
                          if (editor.deleteWorld(id)) {
                            setMenuId(null);
                            setDeleteId(null);
                          }
                        }}
                      >
                        Confirm delete
                      </button>
                      <button onClick={() => setDeleteId(null)}>Cancel</button>
                    </>
                  ) : (
                    <button
                      className="delete-world"
                      onClick={() => setDeleteId(id)}
                    >
                      <Trash2 size={15} aria-hidden="true" /> Delete
                    </button>
                  ))}
              </div>
            )}
          </div>
        ))}
        {savedWorlds.length === 0 && <p>Edit a preset to keep it here.</p>}
      </div>
    </Modal>
  );
}
