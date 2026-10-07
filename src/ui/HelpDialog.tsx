import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { Modal } from "./Modal";

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="How to build" onClose={onClose}>
      <div className="modal-heading">
        <h2>How to build</h2>
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
          Drag with two fingers to pan, including while placing. Pinch to zoom.
          WASD also moves across the tank; hold Shift to move faster. The Home
          button returns to the starting view.
        </dd>
        <dt>Look around</dt>
        <dd>
          Drag with one finger or the mouse to orbit when not placing. Scroll to
          zoom.
        </dd>
        <dt>Rearrange</dt>
        <dd>Select an object, choose Move, then tap its new position.</dd>
        <dt>Watch a creature</dt>
        <dd>
          In View mode, tap a creature or open the info button’s creature list.
          The camera follows it, and foliage fades out of the way. Escape stops
          watching.
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
        <dt>Animal life</dt>
        <dd>
          Planting and tank space support your animals. Healthy adults of the
          same species can have young, which slowly grow up. Crowding and too
          little planting gradually lower condition. An animal with nowhere it
          can live, like a frog in a flooded tank or a fish in a drained one,
          declines within minutes. Follow a creature to see its age and
          condition. Life pauses while the tab is hidden; age, condition and
          offspring stay saved when you return.
        </dd>
        <dt>Saving and sharing</dt>
        <dd>
          Autosaves stay in this browser. My worlds lets you switch habitats
          without losing progress, start another, or import a file. Share sends
          your current layout as a link others can explore and copy. Each
          world’s options include Export file for backups. Undo history resets
          when you switch worlds.
        </dd>
      </dl>
      <p className="panel-note">
        This is a creative habitat sandbox, not a guide to keeping real animals
        together.
      </p>
    </Modal>
  );
}
