import { HeartPulse, SlidersHorizontal, Sprout } from "lucide-react";
import type { Panel } from "./Sidebar";

const panels = [
  { panel: "objects", label: "Add", Icon: Sprout },
  { panel: "habitat", label: "Habitat", Icon: SlidersHorizontal },
  { panel: "life", label: "Life", Icon: HeartPulse },
] as const;

/** Phones keep the scene clear: tools live behind these buttons. */
export function MobileDock({ onOpen }: { onOpen: (panel: Panel) => void }) {
  return (
    <nav className="mobile-dock" aria-label="Tools">
      {panels.map(({ panel, label, Icon }) => (
        <button key={panel} onClick={() => onOpen(panel)}>
          <Icon size={19} />
          {label}
        </button>
      ))}
    </nav>
  );
}
