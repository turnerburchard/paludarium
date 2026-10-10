import { useState } from "react";
import { Modal } from "./Modal";

/** Asks for a new name. Modal focuses the field first, ready to type. */
export function RenameDialog({
  title,
  name,
  placeholder,
  maxLength,
  onSave,
  onClose,
}: {
  title: string;
  name: string;
  placeholder?: string;
  maxLength: number;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(name);
  return (
    <Modal label={title} onClose={onClose}>
      <h2>{title}</h2>
      <form
        className="rename-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft.trim());
        }}
      >
        <input
          aria-label="Name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
        />
        <div className="rename-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="intro-build-button">Save</button>
        </div>
      </form>
    </Modal>
  );
}
