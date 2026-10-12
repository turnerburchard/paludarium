import {
  Eye,
  Hammer,
  HeartPulse,
  SlidersHorizontal,
  Sprout,
} from "lucide-react";
import type { Panel } from "./Sidebar";

const panels = [
  { panel: "objects", label: "Add", Icon: Sprout },
  { panel: "habitat", label: "Habitat", Icon: SlidersHorizontal },
  { panel: "life", label: "Life", Icon: HeartPulse },
] as const;

/** Phones keep the scene clear: switching modes and Build's tools sit here,
 * within thumb reach. View shows only the Build icon. */
export function MobileDock({
  view,
  onChangeMode,
  onOpen,
}: {
  view: boolean;
  onChangeMode: (view: boolean) => void;
  onOpen: (panel: Panel) => void;
}) {
  if (view)
    return (
      <nav className="mobile-dock" aria-label="Tools">
        <button
          aria-label="Build"
          title="Build"
          onClick={() => onChangeMode(false)}
        >
          <Hammer size={22} />
        </button>
      </nav>
    );
  return (
    <nav className="mobile-dock" aria-label="Tools">
      <button onClick={() => onChangeMode(true)}>
        <Eye size={19} />
        View
      </button>
      <span className="dock-divider" />
      {panels.map(({ panel, label, Icon }) => (
        <button key={panel} onClick={() => onOpen(panel)}>
          <Icon size={19} />
          {label}
        </button>
      ))}
    </nav>
  );
}
