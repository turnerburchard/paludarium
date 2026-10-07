import {
  ChevronDown,
  HeartPulse,
  HelpCircle,
  SlidersHorizontal,
  Sprout,
} from "lucide-react";
import type { Editor } from "../editor/useEditor";
import type { EcosystemController } from "../simulation/useEcosystem";
import { EnvironmentPanel } from "./EnvironmentPanel";
import { IconButton } from "./IconButton";
import { Library } from "./Library";
import { LifePanel } from "./LifePanel";

export type Panel = "objects" | "habitat" | "life";

export function Sidebar({
  hidden = false,
  sheetOpen,
  editor,
  ecosystem,
  panel,
  onPanel,
  onHelp,
  onWatch,
  onClose,
}: {
  hidden?: boolean;
  sheetOpen: boolean;
  editor: Editor;
  ecosystem: EcosystemController;
  panel: Panel;
  onPanel: (panel: Panel) => void;
  onHelp: () => void;
  onWatch: (id: string) => void;
  /** Phones show the sidebar as a sheet that can be closed. */
  onClose: () => void;
}) {
  return (
    <aside hidden={hidden} className="sidebar" aria-label="Terrarium tools">
      <div className="panel-tabs">
        {(
          [
            {
              key: "objects",
              label: "Add",
              name: "Add to your world",
              Icon: Sprout,
            },
            {
              key: "habitat",
              label: "Habitat",
              name: "Habitat settings",
              Icon: SlidersHorizontal,
            },
            {
              key: "life",
              label: "Life",
              name: "Habitat life",
              Icon: HeartPulse,
            },
          ] as const
        ).map(({ key, label, name, Icon }) => (
          <button
            key={key}
            className={panel === key ? "active" : ""}
            aria-pressed={panel === key}
            aria-label={name}
            onClick={() => onPanel(key)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
        <span className="sheet-only sheet-close">
          <IconButton label="Close panel" onClick={onClose}>
            <ChevronDown size={18} />
          </IconButton>
        </span>
      </div>
      <div className="panel-content">
        {panel === "objects" ? (
          <Library editor={editor} hidden={hidden} sheetOpen={sheetOpen} />
        ) : panel === "habitat" ? (
          <EnvironmentPanel editor={editor} />
        ) : (
          <LifePanel
            world={editor.world}
            ecosystem={ecosystem}
            selectedId={editor.selectedId}
            paused={editor.paused}
            onWatch={onWatch}
          />
        )}
      </div>
      <div className="sidebar-footer">
        <span>{editor.world.objects.length} inhabitants & objects</span>
        <button onClick={onHelp} aria-label="Controls and help">
          <HelpCircle size={16} />
        </button>
      </div>
    </aside>
  );
}
