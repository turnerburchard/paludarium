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
        <dt>Watch a creature</dt>
        <dd>
          In View mode, tap a creature or choose Watch a creature. The camera
          follows it, and foliage fades out of the way. Escape stops watching.
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
        <dt>See what unfolds</dt>
        <dd>
          Plants shelter insects; shallow shorelines offer moisture. Creatures
          forage, soak, climb and sleep on a sped-up day/night cycle. Life
          records field notes when you see a new behavior. Follow someone to
          take a closer look, or change the habitat to give them new places to
          go. Life pauses while the tab is hidden; activity and notes restart on
          reload.
        </dd>
        <dt>Keep your world</dt>
        <dd>
          Autosaves stay in this browser. Share sends your current layout as a
          link others can explore and copy. Export keeps a file backup.
        </dd>
      </dl>
      <p className="panel-note">
        This is a creative habitat sandbox, not a guide to keeping real animals
        together.
      </p>
    </Modal>
  );
}
