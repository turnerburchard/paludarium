import { Binoculars, CircleHelp, X } from "lucide-react";
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
      <p>
        Plant a tank, add frogs and fish, and watch them live. They hunt the
        insects that shelter in your plants, and over a few hours they mature,
        breed, and grow old.
      </p>
      <div className="about-actions">
        {creatureIds.length > 0 && (
          <button
            onClick={() =>
              onWatch(
                creatureIds[Math.floor(Math.random() * creatureIds.length)],
              )
            }
          >
            <Binoculars size={18} aria-hidden="true" /> Follow a creature
          </button>
        )}
        <button onClick={onHelp}>
          <CircleHelp size={18} aria-hidden="true" /> Controls
        </button>
      </div>
      <footer className="about-footer">
        <a href="https://turnerburchard.com" target="_blank" rel="noreferrer">
          Made by Turner Burchard
        </a>
        <span aria-hidden="true">·</span>
        <a
          href="https://github.com/turnerburchard/paludarium"
          target="_blank"
          rel="noreferrer"
        >
          View source
        </a>
      </footer>
    </Modal>
  );
}
