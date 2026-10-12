import { Eye, Hammer, Keyboard, Move, Share2, X } from "lucide-react";
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
          Drag to rotate the view. Pinch or scroll to zoom. Drag with two
          fingers, or right-drag, to pan. While building, hold Alt/Option and
          drag, or middle-drag, to rotate without using your tool.
        </dd>
        <dt>
          <Hammer size={16} aria-hidden="true" /> Build
        </dt>
        <dd>
          Open Build, pick an object, and tap the tank to place it. Tap anything
          you placed to move, turn, or remove it.
        </dd>
        <dt>
          <Eye size={16} aria-hidden="true" /> Watch
        </dt>
        <dd>Tap an animal, then choose Watch up close to follow it.</dd>
        <dt>
          <Share2 size={16} aria-hidden="true" /> Save and share
        </dt>
        <dd>
          Changes save in this browser. Worlds holds the presets and your saved
          tanks. Share makes a link anyone can open.
        </dd>
        <div className="help-keys">
          <dt>
            <Keyboard size={16} aria-hidden="true" /> Keys
          </dt>
          <dd>
            <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> move the view ·{" "}
            <kbd>Q</kbd> <kbd>E</kbd> turn · <kbd>Delete</kbd> remove ·{" "}
            <kbd>Space</kbd> pause · <kbd>H</kbd> hide controls in View ·{" "}
            <kbd>Ctrl</kbd> <kbd>Z</kbd> undo
          </dd>
        </div>
      </dl>
    </Modal>
  );
}
