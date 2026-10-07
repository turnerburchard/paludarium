import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { Modal } from "./Modal";

export function SharedWorldDialog({
  onCopy,
  onClose,
  error,
}: {
  onCopy: () => void;
  onClose: () => void;
  error?: string;
}) {
  return (
    <Modal label="Build a copy" onClose={onClose}>
      <div className="modal-heading">
        <h2>Build a copy</h2>
        <IconButton label="Keep watching" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      <p>
        Make your own copy to build and save in My worlds. Your other worlds
        stay saved, and your changes won’t affect the original.
      </p>
      {error && <p role="status">{error}</p>}
      <div className="shared-world-actions">
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
