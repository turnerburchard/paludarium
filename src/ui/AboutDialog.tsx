import { useId } from "react";
import {
  Binoculars,
  ChevronRight,
  CircleHelp,
  Globe2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useEcosystemSnapshot,
  type EcosystemController,
} from "../simulation/useEcosystem";
import { IconButton } from "./IconButton";
import { Modal } from "./Modal";

export function AboutDialog({
  onClose,
  onHelp,
  onWorlds,
  ecosystem,
  onWatch,
}: {
  onClose: () => void;
  onHelp: () => void;
  onWorlds: () => void;
  ecosystem: EcosystemController;
  onWatch: (id: string) => void;
}) {
  const snapshot = useEcosystemSnapshot(ecosystem);
  const creatureIds = snapshot.animals.map((animal) => animal.id);
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
      <div className="about-definition">
        <p>
          <strong>pa·lu·dar·i·um</strong> <i>noun</i>
        </p>
        <p>
          A glass tank of land and water, planted and home to small animals.
        </p>
      </div>
      <p className="about-intro">
        Pick a preset and watch its frogs and fish feed, grow, and raise young.
        Or start from an empty tank and build your own.
      </p>
      <div className="about-actions">
        {creatureIds.length > 0 && (
          <AboutAction
            icon={Binoculars}
            label="Follow a creature"
            hint="Watch one up close"
            onClick={() =>
              onWatch(
                creatureIds[Math.floor(Math.random() * creatureIds.length)],
              )
            }
          />
        )}
        <AboutAction
          icon={Globe2}
          label="Worlds"
          hint="Presets and your saved tanks"
          onClick={onWorlds}
        />
        <AboutAction
          icon={CircleHelp}
          label="Controls"
          hint="Looking around and building"
          onClick={onHelp}
        />
      </div>
      <p className="about-privacy">
        Your worlds save in this browser. Shared worlds are stored so their
        links work; nothing else is tracked.
      </p>
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

function AboutAction({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  const hintId = useId();
  return (
    <button aria-label={label} aria-describedby={hintId} onClick={onClick}>
      <Icon size={20} aria-hidden="true" />
      <span>
        {label}
        <small id={hintId}>{hint}</small>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}
