import { X } from "lucide-react";
import type { World } from "../model/schema";
import type { EcosystemController } from "../simulation/useEcosystem";
import { CreatureList } from "./CreatureList";
import { IconButton } from "./IconButton";
import { Modal } from "./Modal";

export function AboutDialog({
  onClose,
  onBuild,
  world,
  ecosystem,
  onWatch,
}: {
  onClose: () => void;
  onBuild: () => void;
  world: World;
  ecosystem: EcosystemController;
  onWatch: (id: string) => void;
}) {
  return (
    <Modal label="About Paludarium" onClose={onClose}>
      <div className="modal-heading">
        <h2>A little world to get lost in</h2>
        <IconButton label="Close introduction" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      <p>
        Paludarium is a living terrarium you can build in your browser. There’s
        no score to chase. Make a place you like, then see who makes it home.
      </p>
      <dl>
        <dt>Start by watching</dt>
        <dd>
          Tap a creature to follow it. Drag to look around; pinch or scroll to
          get closer.
        </dd>
        <dt>Make it yours</dt>
        <dd>
          Switch to Build to plant a forest, arrange logs and rocks, or shape a
          pool and its shoreline.
        </dd>
        <dt>Go a little deeper</dt>
        <dd>
          Plants shelter the insects that feed the frogs. Frogs seek moisture,
          hunt, climb, and rest as day turns to night. Change the habitat and
          watch their choices change.
        </dd>
      </dl>
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
      <button className="intro-build-button" onClick={onBuild}>
        Make it yours
      </button>
      <p className="panel-note">
        No account or download. Your layout saves on this device. Share sends a
        snapshot others can explore and copy; Export keeps a backup.
      </p>
      <a
        className="source-link"
        href="https://github.com/turnerburchard/paludarium"
        target="_blank"
        rel="noreferrer"
      >
        Made by Turner Burchard · View source
      </a>
    </Modal>
  );
}
