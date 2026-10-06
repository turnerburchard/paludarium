import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { Modal } from "./Modal";

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="How to build" onClose={onClose}>
      <div className="modal-heading">
        <h2>Make yourself at home</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      <p>
        Choose an object, then click or tap the tank to place it. Keep placing
        to make a cluster. Done or Escape returns to selection.
      </p>
      <dl>
        <dt>Move the camera</dt>
        <dd>
          WASD moves across the tank. Hold Shift to move faster. The Home button
          returns to the starting view.
        </dd>
        <dt>Look around</dt>
        <dd>Drag with one finger or the mouse. Pinch or scroll to zoom.</dd>
        <dt>Rearrange</dt>
        <dd>Select an object, choose Move, then tap its new home.</dd>
        <dt>Watch a frog</dt>
        <dd>
          In View mode, tap a frog or choose Watch a frog. The camera follows
          it, and foliage fades out of the way. Escape stops watching.
        </dd>
        <dt>Turn</dt>
        <dd>
          Use Left and Right while placing. Tap to turn, hold to spin. R also
          turns; Shift R turns the other way.
        </dd>
        <dt>Undo / redo</dt>
        <dd>⌘ or Ctrl Z / Shift Z. Each slider gesture is one step.</dd>
        <dt>Pause</dt>
        <dd>
          Space pauses the inhabitants. View hides editing tools; Build reveals
          them.
        </dd>
        <dt>Care for the frogs</dt>
        <dd>
          Insects breed in the cover of plants and moss, so more planting feeds
          more frogs. Scatter insects to help out, or mist a dry habitat. Frogs
          forage, soak, explore and sleep on a sped-up day/night cycle. Select
          one to see its needs. Life pauses while the tab is hidden; activity
          restarts on reload.
        </dd>
        <dt>Keep your world</dt>
        <dd>
          Autosaves stay in this browser. Export a file to back up or move
          between devices.
        </dd>
      </dl>
      <p className="panel-note">
        This is a creative habitat sandbox, not a guide to keeping real animals
        together.
      </p>
    </Modal>
  );
}
