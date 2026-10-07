import { useState } from "react";
import {
  Download,
  MoreHorizontal,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { Editor } from "../editor/useEditor";
import { downloadWorld } from "../editor/persistence";
import { IconButton } from "./IconButton";
import { Modal } from "./Modal";

export function WorldsDialog({
  editor,
  onOpen,
  onNew,
  onImport,
  onClose,
}: {
  editor: Editor;
  onOpen: (id: string) => void;
  onNew: () => void;
  onImport: () => void;
  onClose: () => void;
}) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  return (
    <Modal label="My worlds" onClose={onClose}>
      <div className="modal-heading">
        <h2>My worlds</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      <p>Saved automatically in this browser.</p>
      {(editor.message || !editor.saved) && (
        <p role="status">
          {editor.message ||
            "Saving is unavailable. Export a backup before continuing."}
        </p>
      )}
      <div className="world-list">
        {editor.library.worlds.map(({ id, world }) => (
          <div className="saved-world" key={id}>
            <div className="saved-world-heading">
              <button className="open-world" onClick={() => onOpen(id)}>
                <strong>{world.name}</strong>
                <span>
                  {id === editor.library.activeId && !editor.isShared
                    ? "Current world"
                    : "Open world"}
                </span>
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
                <button onClick={() => downloadWorld(world)}>
                  <Download size={15} aria-hidden="true" /> Export file
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
                      <Trash2 size={15} aria-hidden="true" /> Delete world
                    </button>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="world-library-actions">
        <button className="intro-build-button" onClick={onNew}>
          <Plus size={16} /> New world
        </button>
        <button onClick={onImport}>
          <Upload size={15} aria-hidden="true" /> Import file
        </button>
      </div>
    </Modal>
  );
}
