import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Group } from "../assets";
import { IconButton } from "./IconButton";
import { Modal } from "./Modal";

export const places = [
  "Tropical",
  "Temperate",
  "Desert",
  "Underwater",
] as const;
export type Place = (typeof places)[number];

export function LibraryFilter({
  groups,
  chosenPlaces,
  chosenGroups,
  onTogglePlace,
  onToggleGroup,
  onClear,
  onClose,
}: {
  groups: Group[];
  chosenPlaces: Place[];
  chosenGroups: Group[];
  onTogglePlace: (place: Place) => void;
  onToggleGroup: (group: Group) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  // The sidebar is positioned and clips its children, so the dialog renders
  // at the top of the page like the other dialogs.
  return createPortal(
    <Modal label="Filter objects" onClose={onClose}>
      <div className="modal-heading">
        <h2>Filter</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      <h3 className="filter-heading">Biome</h3>
      <Chips items={places} chosen={chosenPlaces} onToggle={onTogglePlace} />
      {groups.length > 1 && (
        <>
          <h3 className="filter-heading">Type</h3>
          <Chips
            items={groups}
            chosen={chosenGroups}
            onToggle={onToggleGroup}
          />
        </>
      )}
      <div className="filter-actions">
        <button onClick={onClear}>Clear</button>
        <button className="primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>,
    document.body,
  );
}

function Chips<T extends string>({
  items,
  chosen,
  onToggle,
}: {
  items: readonly T[];
  chosen: T[];
  onToggle: (item: T) => void;
}) {
  return (
    <div className="filter-chips">
      {items.map((item) => (
        <button
          key={item}
          className={chosen.includes(item) ? "active" : ""}
          aria-pressed={chosen.includes(item)}
          onClick={() => onToggle(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
