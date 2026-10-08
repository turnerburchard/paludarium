import { Binoculars, Eye, Hammer, HelpCircle, X } from "lucide-react";
import { assets } from "../assets";
import type { World } from "../model/schema";
import type { EcosystemController } from "../simulation/useEcosystem";
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
  const creatureIds = [
    ...ecosystem.snapshot.animals.map((animal) => animal.id),
    ...world.objects
      .filter((object) => assets[object.kind].swims)
      .map((object) => object.id),
  ];
  return (
    <Modal label="About Paludarium" onClose={onClose}>
      <div className="modal-heading">
        <h2>Paludarium</h2>
        <IconButton label="Close introduction" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      <dl>
        <dt>
          <Eye size={16} aria-hidden="true" /> View
        </dt>
        <dd>
          Tap a creature to learn about it, then watch up close. Drag to look
          around; pinch or scroll to get closer.
        </dd>
        <dt>
          <Hammer size={16} aria-hidden="true" /> Build
        </dt>
        <dd>Switch to Build to add objects or edit the terrain.</dd>
      </dl>
      {creatureIds.length > 0 && (
        <button
          className="life-follow"
          onClick={() =>
            onWatch(creatureIds[Math.floor(Math.random() * creatureIds.length)])
          }
        >
          <Binoculars size={19} aria-hidden="true" /> Follow a creature
        </button>
      )}
      <p className="panel-note">
        Your layout saves on this device. Share sends a snapshot others can
        explore and copy; Export keeps a backup.
      </p>
      <button className="intro-build-button" onClick={onHelp}>
        <HelpCircle size={16} aria-hidden="true" /> Controls and help
      </button>
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
