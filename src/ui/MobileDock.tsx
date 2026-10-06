import {
  Eye,
  HeartPulse,
  Pause,
  Play,
  SlidersHorizontal,
  Sprout,
} from "lucide-react";
import type { Editor } from "../editor/useEditor";
import type { Panel } from "./Sidebar";

const panels = [
  { panel: "objects", label: "Add", Icon: Sprout },
  { panel: "habitat", label: "Habitat", Icon: SlidersHorizontal },
  { panel: "life", label: "Life", Icon: HeartPulse },
] as const;

/** Phones keep the scene clear: tools live behind these buttons. */
export function MobileDock({
  editor,
  onOpen,
  onWatchWorld,
}: {
  editor: Editor;
  onOpen: (panel: Panel) => void;
  onWatchWorld: () => void;
}) {
  return (
    <nav className="mobile-dock" aria-label="Tools">
      {panels.map(({ panel, label, Icon }) => (
        <button key={panel} onClick={() => onOpen(panel)}>
          <Icon size={19} />
          {label}
        </button>
      ))}
      <span className="dock-divider" />
      <button
        onClick={() => editor.setPaused((p) => !p)}
        aria-label={editor.paused ? "Resume life" : "Pause life"}
      >
        {editor.paused ? <Play size={19} /> : <Pause size={19} />}
      </button>
      <button onClick={onWatchWorld} aria-label="Watch your world">
        <Eye size={19} />
      </button>
    </nav>
  );
}
