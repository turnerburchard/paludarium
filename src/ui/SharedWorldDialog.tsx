import { X } from "lucide-react";
import { downloadWorld, loadWorld, STORAGE_KEY } from "../editor/persistence";
import { IconButton } from "./IconButton";
import { Modal } from "./Modal";

export function SharedWorldDialog({
  onCopy,
  onClose,
}: {
  onCopy: () => void;
  onClose: () => void;
}) {
  let hasSavedWorld = false;
  try {
    hasSavedWorld = !!localStorage.getItem(STORAGE_KEY);
  } catch {
    /* Storage may be unavailable. */
  }
  return (
    <Modal label="Build a copy" onClose={onClose}>
      <div className="modal-heading">
        <h2>Make this world yours</h2>
        <IconButton label="Keep watching" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      <p>
        {hasSavedWorld
          ? "Building a copy will replace your saved habitat on this device. You can export it first, or Undo after copying to bring it back."
          : "Make your own copy to build and save on this device. Your changes won’t affect the original."}
      </p>
      <div className="shared-world-actions">
        {hasSavedWorld && (
          <button onClick={() => downloadWorld(loadWorld().world)}>
            Export my world
          </button>
        )}
        <button className="intro-build-button" onClick={onCopy}>
          Build a copy
        </button>
      </div>
    </Modal>
  );
}

export function WorldLinkError({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="Couldn’t open this world" onClose={onClose}>
      <div className="modal-heading">
        <h2>Couldn’t open this world</h2>
      </div>
      <p>
        The link may be incomplete or use an unsupported format. Your saved
        world hasn’t changed.
      </p>
      <button className="intro-build-button" onClick={onClose}>
        Return to my world
      </button>
    </Modal>
  );
}
