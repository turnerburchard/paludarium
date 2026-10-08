import { Eye, Hammer, Move, Share2, X } from "lucide-react";
import { IconButton } from "./IconButton";
import { Modal } from "./Modal";

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="Controls and help" onClose={onClose}>
      <div className="modal-heading">
        <h2>Controls and help</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      <dl>
        <dt>
          <Move size={16} aria-hidden="true" /> Look around
        </dt>
        <dd>
          Drag with one finger or the mouse to rotate. Pinch or scroll to zoom.
          Drag with two fingers to move across the tank, even while placing
          objects.
        </dd>
        <dt>
          <Hammer size={16} aria-hidden="true" /> Build
        </dt>
        <dd>
          Switch to Build, choose an object, then tap the tank to place it.
          Choose Done to finish. Select an object to move, turn, or remove it.
        </dd>
        <dt>
          <Eye size={16} aria-hidden="true" /> Watch
        </dt>
        <dd>Tap an animal, then choose Watch up close to follow it.</dd>
        <dt>
          <Share2 size={16} aria-hidden="true" /> Save and share
        </dt>
        <dd>
          Your edits save in this browser. Worlds opens presets and saved
          habitats. Share makes a link others can explore.
        </dd>
      </dl>
      <p className="panel-note">Open this help again from the info menu.</p>
    </Modal>
  );
}
