import { Eye, Hammer, Move, Share2, X } from "lucide-react";
import { IconButton } from "./IconButton";
import { Modal } from "./Modal";

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="Controls" onClose={onClose}>
      <div className="modal-heading">
        <h2>Controls</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      <dl>
        <dt>
          <Move size={16} aria-hidden="true" /> Look around
        </dt>
        <dd>
          Drag to rotate. Pinch or scroll to zoom. Drag with two fingers to pan.
        </dd>
        <dt>
          <Hammer size={16} aria-hidden="true" /> Build
        </dt>
        <dd>
          In Build, pick an object and tap the tank to place it. Tap a placed
          object to move, turn, or remove it.
        </dd>
        <dt>
          <Eye size={16} aria-hidden="true" /> Watch
        </dt>
        <dd>Tap an animal, then Watch up close to follow it.</dd>
        <dt>
          <Share2 size={16} aria-hidden="true" /> Save and share
        </dt>
        <dd>
          Edits save in this browser. Worlds has presets and your saved tanks.
          Share makes a link.
        </dd>
      </dl>
    </Modal>
  );
}
