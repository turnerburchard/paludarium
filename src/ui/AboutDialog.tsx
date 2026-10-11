import { Binoculars, Bug, Egg, HelpCircle, Hourglass, X } from "lucide-react";
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
          <Bug size={16} aria-hidden="true" /> Food
        </dt>
        <dd>
          Plants shelter the insects that animals eat. Plan on one healthy plant
          per animal.
        </dd>
        <dt>
          <Egg size={16} aria-hidden="true" /> Breeding
        </dt>
        <dd>
          Grown pairs of the same kind breed when there is spare food and room.
        </dd>
        <dt>
          <Hourglass size={16} aria-hidden="true" /> Death
        </dt>
        <dd>
          Animals live a few hours. Hunger and crowding cut that short, and
          frogs need land while fish need water.
        </dd>
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
      <button className="intro-build-button" onClick={onHelp}>
        <HelpCircle size={16} aria-hidden="true" /> Controls
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
