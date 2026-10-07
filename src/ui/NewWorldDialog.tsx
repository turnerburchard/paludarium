import { X } from "lucide-react";
import type { Preset } from "../model/presets";
import { IconButton } from "./IconButton";
import { Modal } from "./Modal";

export function NewWorldDialog({
  onPreset,
  onClose,
}: {
  onPreset: (preset: Preset) => void;
  onClose: () => void;
}) {
  return (
    <Modal label="Start a world" onClose={onClose}>
      <div className="modal-heading">
        <h2>A new little world</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      <p>
        Start from scratch or settle into a ready-made habitat. Undo can bring
        your previous world back.
      </p>
      <div className="preset-options">
        <button onClick={() => onPreset("empty")}>
          <span>01</span>
          <strong>Empty tank</strong>
        </button>
        <button onClick={() => onPreset("tropical")}>
          <span>02</span>
          <strong>Cloud forest</strong>
        </button>
        <button onClick={() => onPreset("mountain")}>
          <span>03</span>
          <strong>Alpine creek</strong>
        </button>
        <button onClick={() => onPreset("aquarium")}>
          <span>04</span>
          <strong>Aquarium</strong>
          <small>
            A whole underwater world, with driftwood and schooling fish.
          </small>
        </button>
      </div>
    </Modal>
  );
}
