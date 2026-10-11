import { Binoculars, Eye, Hammer, Leaf, X } from "lucide-react";
import type { EcosystemController } from "../simulation/useEcosystem";
import { IconButton } from "./IconButton";
import { Modal } from "./Modal";

export function AboutDialog({
  onClose,
  onHelp,
  ecosystem,
  onWatch,
}: {
  onClose: () => void;
  onHelp: () => void;
  ecosystem: EcosystemController;
  onWatch: (id: string) => void;
}) {
  const creatureIds = ecosystem.snapshot.animals.map((animal) => animal.id);
  return (
    <Modal label="About Paludarium" onClose={onClose}>
      <div className="modal-heading">
        <h2 className="about-brand">
          <img src="./paludarium-mark-light.svg" alt="" /> paludarium
        </h2>
        <IconButton label="Close introduction" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      <p>Build a planted tank, add frogs and fish, and watch them live.</p>
      <dl>
        <dt>
          <Eye size={16} aria-hidden="true" /> Watch
        </dt>
        <dd>Tap any animal to see what it is doing and follow it.</dd>
        <dt>
          <Hammer size={16} aria-hidden="true" /> Build
        </dt>
        <dd>Add plants, rocks and animals, or reshape the land and water.</dd>
        <dt>
          <Leaf size={16} aria-hidden="true" /> Life
        </dt>
        <dd>
          Animals eat insects that live among the plants. Over hours they grow,
          breed and die.
        </dd>
      </dl>
      <div className="dialog-actions">
        {creatureIds.length > 0 && (
          <button
            className="intro-build-button"
            onClick={() =>
              onWatch(
                creatureIds[Math.floor(Math.random() * creatureIds.length)],
              )
            }
          >
            <Binoculars size={16} aria-hidden="true" /> Follow a creature
          </button>
        )}
        <button onClick={onHelp}>Controls</button>
      </div>
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
