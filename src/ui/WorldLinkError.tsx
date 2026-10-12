import { Modal } from "./Modal";

export function WorldLinkError({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="Couldn’t open this world" onClose={onClose}>
      <div className="modal-heading">
        <h2>Couldn’t open this world</h2>
      </div>
      <p>The link may be incomplete or no longer work.</p>
      <button className="intro-build-button" onClick={onClose}>
        Continue
      </button>
    </Modal>
  );
}
