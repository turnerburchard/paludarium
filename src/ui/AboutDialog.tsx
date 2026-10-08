import { X } from "lucide-react";
import type { World } from "../model/schema";
import type { EcosystemController } from "../simulation/useEcosystem";
import { CreatureList } from "./CreatureList";
import { IconButton } from "./IconButton";
import { Modal } from "./Modal";

export function AboutDialog({
  onClose,
  onHelp,
  world,
  ecosystem,
  onWatch,
}: {
  onClose: () => void;
  onHelp: () => void;
  world: World;
  ecosystem: EcosystemController;
  onWatch: (id: string) => void;
}) {
  return (
    <Modal label="About Paludarium" onClose={onClose}>
      <div className="modal-heading">
        <h2>Paludarium</h2>
        <IconButton label="Close introduction" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      <dl>
        <dt>View</dt>
        <dd>
          Tap a creature to learn about it, then watch up close. Drag to look
          around; pinch or scroll to get closer.
        </dd>
        <dt>Build</dt>
        <dd>Switch to Build to add objects or edit the terrain.</dd>
      </dl>
      <button className="intro-build-button" onClick={onHelp}>
        Controls and help
      </button>
      {ecosystem.snapshot.animals.length > 0 && (
        <details className="more-options creature-options">
          <summary>Follow a creature</summary>
          <CreatureList
            world={world}
            animals={ecosystem.snapshot.animals}
            onWatch={onWatch}
          />
        </details>
      )}
      <p className="panel-note">
        Your layout saves on this device. Share sends a snapshot others can
        explore and copy; Export keeps a backup.
      </p>
      <div className="modal-footer">
        <a
          className="source-link"
          href="https://turnerburchard.com"
          target="_blank"
          rel="noreferrer"
        >
          Made by Turner Burchard
        </a>
        <p> · </p>
        <a
          className="source-link"
          href="https://github.com/turnerburchard/paludarium"
          target="_blank"
          rel="noreferrer"
        >
          View source
        </a>
      </div>
    </Modal>
  );
}
